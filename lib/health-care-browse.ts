/**
 * Health care category routing — no imports from `product-subslug` (avoids cycles with `product-visibility`).
 * Kept aligned with common `resolveProductSubSlug` buckets for Biz Care + scrub listings.
 */

import { isBizCareListingInMiscGeneratedSet } from "@/lib/biz-care-misc-route";
import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";

export type HealthCareBrowseSubSlug = "tops" | "pants" | "miscellaneous";

export type HealthCareListingMeta = {
  slug?: string | null;
  category?: string | null;
  description?: string | null;
};

function listingTextBlob(productName: string, meta?: HealthCareListingMeta): string {
  return [productName, meta?.slug ?? "", meta?.category ?? "", meta?.description ?? ""]
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

/** Biz Care only (not Biz Collection). */
export function isBizCareListing(productName: string, meta?: HealthCareListingMeta): boolean {
  return listingTextBlob(productName, meta).includes("biz care");
}

export function listingLooksLikeScrubGarment(productName: string, meta?: HealthCareListingMeta): boolean {
  return /\bscrub(s|wear)?\b/.test(listingTextBlob(productName, meta));
}

/**
 * Health care main: Biz Care brand lines + any scrub garment (any supplier).
 * Biz Collection remains under Men's / Women's / Kid's.
 */
function listingMatches4srpScrubSku(productName: string, meta?: HealthCareListingMeta): boolean {
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  return /\b4SRP\b/i.test(hay);
}

/** Fashion Biz SKUs that must live only under Health care → Tops (never Chef / other mains). */
const HEALTH_CARE_TOPS_EXCLUSIVE_STYLE_CODES = new Set(
  ["CK961LV", "CO343LV", "CO343MV"].map((c) => c.toUpperCase()),
);

/** Fashion Biz SKUs that must live only under Health care → Miscellaneous (no Tops/Pants or other mains). */
const HEALTH_CARE_MISCELLANEOUS_EXCLUSIVE_STYLE_CODES = new Set(["CID940U"].map((c) => c.toUpperCase()));

function isHealthCareTopsExclusiveStyleListing(productName: string, meta?: HealthCareListingMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  return HEALTH_CARE_TOPS_EXCLUSIVE_STYLE_CODES.has(base);
}

function isHealthCareMiscExclusiveStyleListing(productName: string, meta?: HealthCareListingMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (HEALTH_CARE_MISCELLANEOUS_EXCLUSIVE_STYLE_CODES.has(base)) {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.category ?? ""}\n${meta?.description ?? ""}`.toUpperCase();
  for (const sku of HEALTH_CARE_MISCELLANEOUS_EXCLUSIVE_STYLE_CODES) {
    if (new RegExp(`\\b${sku}\\b`).test(hay)) {
      return true;
    }
  }
  return false;
}

export function isHealthCareCatalogListing(productName: string, meta?: HealthCareListingMeta): boolean {
  return (
    isBizCareListingInMiscGeneratedSet(productName, meta?.slug ?? null) ||
    isBizCareListing(productName, meta) ||
    listingLooksLikeScrubGarment(productName, meta) ||
    listingMatches4srpScrubSku(productName, meta) ||
    isHealthCareTopsExclusiveStyleListing(productName, meta) ||
    isHealthCareMiscExclusiveStyleListing(productName, meta)
  );
}

export function resolveHealthCareBrowseSubSlug(
  productName: string,
  meta?: HealthCareListingMeta,
): HealthCareBrowseSubSlug | null {
  if (!isHealthCareCatalogListing(productName, meta)) {
    return null;
  }
  if (isHealthCareTopsExclusiveStyleListing(productName, meta)) {
    return "tops";
  }
  if (isHealthCareMiscExclusiveStyleListing(productName, meta)) {
    return "miscellaneous";
  }
  const blob = listingTextBlob(productName, meta);

  if (listingMatches4srpScrubSku(productName, meta)) {
    return "pants";
  }

  if (
    /\b(shoe|shoes|sneaker|boot|boots)\b/.test(blob) ||
    /\b(glove|gloves)\b/.test(blob) ||
    /\b(spec|specs|spectacles|safety glass|safty glass)\b/.test(blob) ||
    /\b(head wear|headwear|helmet|hard hat|balaclava|beanie|cap|caps|visor|hijab)\b/.test(blob) ||
    /\b(hi[\s-]*vis|high[\s-]*vis)\b/.test(blob) ||
    /\bapron\b/.test(blob) ||
    /\bpinny\b/.test(blob) ||
    (blob.includes("bib") && !/\bbible\b/i.test(blob)) ||
    /\bchef\b/.test(blob) ||
    /\bcoverall\b/.test(blob) ||
    /\boveralls?\b/.test(blob) ||
    /\bvests?\b/.test(blob) ||
    /\b(sock|socks|bag|bags|stethoscope|scrub\s*cap|surgical\s*cap)\b/.test(blob)
  ) {
    return "miscellaneous";
  }

  if (
    /\b(pant|pants|trouser|trousers|jogger|joggers|shorts|legging)\b/.test(blob)
  ) {
    return "pants";
  }

  return "tops";
}

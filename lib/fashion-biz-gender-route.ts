import bizCollectionKidsOnlyTShirtsCodes from "@/lib/biz-collection-kids-only-t-shirts.json";
import { FASHION_BIZ_STYLE_GENDER, type FashionBizListingGender } from "@/lib/fashion-biz-gender.generated";
import { FASHION_BIZ_LISTING_SUBSLUG } from "@/lib/fashion-biz-listing-subslug.generated";
import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";

/** CSV gender (`mens` / `womens` / `unisex`) plus Kid's-only boutique rows (e.g. `*KS` polos). */
export type FashionBizListingAudience = FashionBizListingGender | "kids";

/** Name, slug, and DB category — hyphens/spaces stripped in `normalizeBizListingMarkers` so `biz-collection` still gates. */
function bizListingGateSearchText(
  productName: string,
  storeSlug?: string | null,
  category?: string | null,
): string {
  return [productName.trim(), (storeSlug ?? "").trim(), (category ?? "").trim()]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeBizListingMarkers(text: string): string {
  return text.replace(/[^a-z0-9]/g, "");
}

export function isBizCareOrCollectionListing(
  productName: string,
  storeSlug?: string | null,
  category?: string | null,
): boolean {
  const n = normalizeBizListingMarkers(bizListingGateSearchText(productName, storeSlug, category));
  return n.includes("bizcare") || n.includes("bizcollection");
}

export function isBizCollectionListing(
  productName: string,
  storeSlug?: string | null,
  category?: string | null,
): boolean {
  const n = normalizeBizListingMarkers(bizListingGateSearchText(productName, storeSlug, category));
  return n.includes("bizcollection");
}

/** Overrides CSV-derived gender; these list only under Women's (e.g. women's scrubs). */
const FASHION_BIZ_STYLE_GENDER_MANUAL: Partial<Record<string, FashionBizListingGender>> = {
  CS952LS: "womens",
  CT247LL: "womens",
  J428U: "mens",
  J833: "mens",
  J8600: "mens",
  NV5300: "mens",
  P3325: "womens",
  P413US: "womens",
  CSP102UL: "womens",
  CST250US: "womens",
  CST313MS: "womens",
  SG319L: "womens",
  SG702L: "womens",
  SW225M: "mens",
  SW710M: "mens",
  T10022: "womens",
  T301LS: "womens",
  T403L: "womens",
  T701LS: "womens",
  T800L: "womens",
  T800LS: "womens",
};

/** Kid's → Polos only (CSV may still say `unisex`). */
const FASHION_BIZ_KIDS_ONLY_POLO_CODES = new Set(["P7700B"].map((c) => c.toUpperCase()));

/** Kid's → T-Shirts only (CSV may still say `unisex`). */
const FASHION_BIZ_KIDS_ONLY_TSHIRT_CODES = new Set(["T10032"].map((c) => c.toUpperCase()));

/** Biz Collection kid tee SKUs (`*KS` lines) — CSV `unisex` would otherwise map to Men's and hide under Kid's. */
const BIZ_COLLECTION_KIDS_ONLY_T_SHIRT_STYLE_CODES = new Set(
  (bizCollectionKidsOnlyTShirtsCodes as readonly string[]).map((c) => c.toUpperCase()),
);

/**
 * Listing tokens are often `T10032L` while CSV keys are `T10032`. Allow optional A–Z suffix only
 * (reject `T100320` etc.).
 */
export function listingCodeMatchesKidsOnlyTshirt(code: string): boolean {
  const u = code.toUpperCase().trim();
  for (const base of FASHION_BIZ_KIDS_ONLY_TSHIRT_CODES) {
    if (u === base) {
      return true;
    }
    if (u.startsWith(base) && u.length > base.length) {
      const rest = u.slice(base.length);
      if (/^[A-Z]+$/.test(rest)) {
        return true;
      }
    }
  }
  return false;
}

function fashionBizStyleCodeFromSlugOnly(storeSlug?: string | null): string | null {
  return storeSlug ? fashionBizStyleCodeFromListing("", storeSlug) : null;
}

function fashionBizStyleCodeFromNameOnly(productName: string): string | null {
  return fashionBizStyleCodeFromListing(productName, null);
}

/**
 * Slug-only and name-only style codes (folder/SKS can differ; name may wrongly say `P7700` while slug is `p7700b`).
 * Also match kid-only override SKUs anywhere in slug/title when structured `Biz Care …` parse fails.
 */
function fashionBizListingStyleCodeCandidates(productName: string, storeSlug?: string | null): string[] {
  const fromSlug = fashionBizStyleCodeFromSlugOnly(storeSlug);
  const fromName = fashionBizStyleCodeFromNameOnly(productName);
  const slug = (storeSlug ?? "").toUpperCase();
  const title = productName.toUpperCase();
  const fromRaw: string[] = [];
  for (const code of FASHION_BIZ_KIDS_ONLY_TSHIRT_CODES) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^A-Z0-9])${escaped}[A-Z]*(?:[^A-Z0-9]|$)`, "i");
    if (re.test(slug) || re.test(title)) {
      fromRaw.push(code);
    }
  }
  return [...new Set([fromSlug, fromName, ...fromRaw].filter((c): c is string => Boolean(c)))];
}

/** Style code or raw slug/title contains a kid-only tee SKU (e.g. T10032). */
export function fashionBizListingKidsOnlyTshirtMatched(
  productName: string,
  storeSlug?: string | null,
): boolean {
  return fashionBizListingStyleCodeCandidates(productName, storeSlug).some((c) =>
    listingCodeMatchesKidsOnlyTshirt(c),
  );
}

/**
 * Men's / Women's browse: Biz Care & Biz Collection rows are split by CSV-derived audience.
 * Returns null when not gated or style code unknown → allow in any main category.
 */
export function fashionBizListingGenderAudience(
  productName: string,
  storeSlug?: string | null,
  category?: string | null,
): FashionBizListingAudience | null {
  const codeCandidates = fashionBizListingStyleCodeCandidates(productName, storeSlug);

  /** Kid's T-shirts: do not require Biz Care/Collection in text (slug-only rows still gate on SKU). */
  if (codeCandidates.some((c) => listingCodeMatchesKidsOnlyTshirt(c))) {
    return "kids";
  }

  if (codeCandidates.some((c) => BIZ_COLLECTION_KIDS_ONLY_T_SHIRT_STYLE_CODES.has(c.toUpperCase()))) {
    return "kids";
  }

  if (!isBizCareOrCollectionListing(productName, storeSlug, category)) {
    return null;
  }

  if (codeCandidates.some((c) => FASHION_BIZ_KIDS_ONLY_POLO_CODES.has(c))) {
    return "kids";
  }

  const ksCodes = codeCandidates.filter((c) => c.includes("KS"));
  if (ksCodes.length > 0) {
    if (ksCodes.some((c) => FASHION_BIZ_LISTING_SUBSLUG[c] === "polos")) {
      return "kids";
    }
    const cat = String(category ?? "").toLowerCase();
    if (cat.includes("polo")) {
      return "kids";
    }
  }

  /** Prefer slug-derived SKU when present (matches product URL / folder). */
  const code = fashionBizStyleCodeFromSlugOnly(storeSlug) ?? fashionBizStyleCodeFromNameOnly(productName);
  if (!code) {
    if (isBizCollectionListing(productName, storeSlug, category) && productName.toUpperCase().includes("TP")) {
      return "mens";
    }
    return null;
  }
  if (isBizCollectionListing(productName, storeSlug, category) && code.toUpperCase().includes("TP")) {
    return "mens";
  }
  if (listingCodeMatchesKidsOnlyTshirt(code)) {
    return "kids";
  }
  if (BIZ_COLLECTION_KIDS_ONLY_T_SHIRT_STYLE_CODES.has(code.toUpperCase())) {
    return "kids";
  }
  const manual = FASHION_BIZ_STYLE_GENDER_MANUAL[code];
  if (manual) {
    return manual;
  }
  const derived = FASHION_BIZ_STYLE_GENDER[code] ?? null;
  return derived === "unisex" ? "mens" : derived;
}

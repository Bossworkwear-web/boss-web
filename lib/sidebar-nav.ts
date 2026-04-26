import { PPE_EXCLUSIVE_SUB_SLUGS } from "@/lib/catalog";
import { fashionBizListingGenderAudience } from "@/lib/fashion-biz-gender-route";
import {
  isHealthCareCatalogListing,
  resolveHealthCareBrowseSubSlug,
} from "@/lib/health-care-browse";
import { inferSubSlugFromProductName, resolveProductSubSlug } from "@/lib/product-subslug";
import {
  isBagKeywordProduct,
  isBisleyCatalogProduct,
  isBizCollectionWomensChefPantsChefPantsExclusiveListing,
  isChefMiscellaneousExclusiveJbStyleListing,
  isHeadWearKeywordProduct,
  isJbWearSixSeriesListing,
  isSocksKeywordProduct,
  isSyzmikCatalogProduct,
  isSyzmikZaPpeMiscListing,
  isYesChefCatalogProduct,
} from "@/lib/product-visibility";

export { inferSubSlugFromProductName };

export const SIDEBAR_NAV_STORAGE_KEY = "boss-sidebar-nav-v1";

export type SidebarNavPersist = {
  mainSlug: string;
  subSlug: string;
};

const PPE_SUBS = new Set(PPE_EXCLUSIVE_SUB_SLUGS);

/** Pick a default top-level menu slug when only product name + sub are known. */
export function inferMainSlugForProduct(
  name: string,
  subSlug: string,
  meta?: {
    slug?: string | null;
    category?: string | null;
    supplier_name?: string | null;
    description?: string | null;
  },
): string {
  if (isHealthCareCatalogListing(name, meta)) {
    return "health-care";
  }
  if (isSocksKeywordProduct(name, meta)) {
    return "ppe";
  }
  if (isBagKeywordProduct(name, meta)) {
    return "ppe";
  }
  if (isJbWearSixSeriesListing(name, meta)) {
    return "workwear";
  }
  if (subSlug === "hi-vis-vest") {
    return "workwear";
  }
  if (subSlug === "head-wear") {
    if (isSyzmikCatalogProduct(name, meta) || isBisleyCatalogProduct(name, meta)) {
      return "workwear";
    }
  }
  if (isHeadWearKeywordProduct(name)) {
    return "ppe";
  }
  if (isSyzmikZaPpeMiscListing(name, meta)) {
    return "ppe";
  }
  if (isSyzmikCatalogProduct(name, meta)) {
    return "workwear";
  }
  if (PPE_SUBS.has(subSlug)) {
    return "ppe";
  }
  if (isBizCollectionWomensChefPantsChefPantsExclusiveListing(name, meta)) {
    return "chef";
  }
  if (isYesChefCatalogProduct(name, meta)) {
    return "chef";
  }
  if (subSlug === "chef" || subSlug === "apron") {
    return "chef";
  }
  if (fashionBizListingGenderAudience(name, meta?.slug ?? null, meta?.category ?? null) === "kids") {
    return "kids";
  }
  const n = name.toLowerCase();
  if (n.includes("women") || n.includes("ladies") || n.includes("female")) {
    return "womens";
  }
  if (n.includes("kid") || n.includes("children")) {
    return "kids";
  }
  return "mens";
}

export function readSidebarNavClient(): SidebarNavPersist | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(SIDEBAR_NAV_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "mainSlug" in parsed &&
      "subSlug" in parsed &&
      typeof (parsed as SidebarNavPersist).mainSlug === "string" &&
      typeof (parsed as SidebarNavPersist).subSlug === "string"
    ) {
      return parsed as SidebarNavPersist;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function persistSidebarNavClient(mainSlug: string, subSlug: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload: SidebarNavPersist = { mainSlug, subSlug };
    window.sessionStorage.setItem(SIDEBAR_NAV_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event("boss-sidebar-nav"));
  } catch {
    /* ignore */
  }
}

export function syncSidebarNavFromProductIfNeeded(
  productName: string,
  category?: string | null,
  storeSlug?: string | null,
  supplierName?: string | null,
  description?: string | null,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const inferredSub = resolveProductSubSlug(productName, category ?? null, storeSlug ?? null);
  const stored = readSidebarNavClient();
  const jbSixMeta = { slug: storeSlug ?? null, supplier_name: supplierName ?? null };

  const healthSub = resolveHealthCareBrowseSubSlug(productName, {
    slug: storeSlug ?? null,
    category: category ?? null,
    description: description ?? null,
  });
  if (healthSub != null) {
    if (stored?.mainSlug === "health-care" && stored?.subSlug === healthSub) {
      return;
    }
    persistSidebarNavClient("health-care", healthSub);
    return;
  }

  const chefMiscExclusiveMeta = {
    slug: storeSlug ?? null,
    category: category ?? null,
    description: description ?? null,
    supplier_name: supplierName ?? null,
  };
  if (isChefMiscellaneousExclusiveJbStyleListing(productName, chefMiscExclusiveMeta)) {
    if (stored?.mainSlug === "chef" && stored?.subSlug === "miscellaneous") {
      return;
    }
    persistSidebarNavClient("chef", "miscellaneous");
    return;
  }

  const bizChefPantsMeta = {
    slug: storeSlug ?? null,
    category: category ?? null,
    description: description ?? null,
    supplier_name: supplierName ?? null,
  };
  if (isBizCollectionWomensChefPantsChefPantsExclusiveListing(productName, bizChefPantsMeta)) {
    if (stored?.mainSlug === "chef" && stored?.subSlug === "pants") {
      return;
    }
    persistSidebarNavClient("chef", "pants");
    return;
  }

  if (isSocksKeywordProduct(productName, { category })) {
    if (stored?.mainSlug === "ppe" && stored?.subSlug === "miscellaneous") {
      return;
    }
    persistSidebarNavClient("ppe", "miscellaneous");
    return;
  }

  if (isBagKeywordProduct(productName, { category })) {
    if (stored?.mainSlug === "ppe" && stored?.subSlug === "miscellaneous") {
      return;
    }
    persistSidebarNavClient("ppe", "miscellaneous");
    return;
  }

  if (isJbWearSixSeriesListing(productName, jbSixMeta)) {
    if (stored?.mainSlug === "workwear" && stored?.subSlug === inferredSub) {
      return;
    }
    persistSidebarNavClient("workwear", inferredSub);
    return;
  }

  if (isHeadWearKeywordProduct(productName)) {
    if (stored?.mainSlug === "ppe" && stored?.subSlug === "head-wear") {
      return;
    }
    persistSidebarNavClient("ppe", "head-wear");
    return;
  }

  const workwearMeta = { slug: storeSlug, category, supplier_name: supplierName ?? null };

  if (isSyzmikZaPpeMiscListing(productName, workwearMeta)) {
    if (stored?.mainSlug === "ppe" && stored?.subSlug === "miscellaneous") {
      return;
    }
    persistSidebarNavClient("ppe", "miscellaneous");
    return;
  }

  if (isSyzmikCatalogProduct(productName, workwearMeta)) {
    if (stored?.mainSlug === "workwear" && stored?.subSlug === inferredSub) {
      return;
    }
    persistSidebarNavClient("workwear", inferredSub);
    return;
  }

  if (isBisleyCatalogProduct(productName, workwearMeta)) {
    if (stored?.mainSlug === "workwear" && stored?.subSlug === inferredSub) {
      return;
    }
    persistSidebarNavClient("workwear", inferredSub);
    return;
  }

  if (stored?.subSlug === inferredSub) {
    return;
  }
  const main = inferMainSlugForProduct(productName, inferredSub, {
    ...workwearMeta,
    supplier_name: supplierName ?? null,
    description: description ?? null,
  });
  persistSidebarNavClient(main, inferredSub);
}

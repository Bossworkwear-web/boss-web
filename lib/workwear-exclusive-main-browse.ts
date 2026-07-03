import type { CategoryBrowseProductRow } from "@/lib/main-category-browse";
import { isBizCollectionListing } from "@/lib/fashion-biz-gender-route";
import { isDncPpeGloveExclusiveListing } from "@/lib/dnc-glove-routing";
import { isDncPpeSafetyGlassesExclusiveListing } from "@/lib/dnc-safety-glasses-routing";
import {
  hasStorefrontListNameAndPrice,
  isAussiePacificCatalogListing,
  isJbWearSixSeriesListing,
  isJbWorkwearExcludedHeadwearOrSocks,
} from "@/lib/product-visibility";

function inferredWorkwearExclusiveBrand(item: CategoryBrowseProductRow): string {
  const hay = `${item.name} ${item.slug ?? ""} ${item.description ?? ""}`.toLowerCase();
  if (hay.includes("syzmik")) {
    return "Syzmik";
  }
  if (hay.includes("bisley")) {
    return "Bisley";
  }
  const direct = String(item.supplier_name ?? "").trim();
  if (direct) {
    const lower = direct.toLowerCase();
    if (lower === "jb's wear" || lower === "jbs wear" || lower === "jbswear" || /\bjbs\s*wear\b/i.test(lower)) {
      return "JB's Wear";
    }
    return direct;
  }
  if (hay.includes("jb-") || hay.includes("jbs")) {
    return "JB's Wear";
  }
  return "";
}

function jbLooksHiVis(item: CategoryBrowseProductRow): boolean {
  const hay = `${item.name} ${item.slug ?? ""} ${item.category ?? ""} ${item.description ?? ""}`.toLowerCase();
  return /\bhv\b/.test(hay) || /\bhi[\s-]*vis\b/.test(hay) || /\bhigh[\s-]*vis\b/.test(hay);
}

function looksWorkwearKeywordListing(item: CategoryBrowseProductRow): boolean {
  const hay = `${item.name} ${item.slug ?? ""} ${item.category ?? ""} ${item.description ?? ""}`.toLowerCase();
  return (
    /\bhv\b/.test(hay) ||
    /\bhi[\s-]*vis\b/.test(hay) ||
    /\bhigh[\s-]*vis\b/.test(hay) ||
    /\bwork\s*shirt\b/.test(hay) ||
    /\bwork\s*shirts?\b/.test(hay) ||
    /\breflective\b/.test(hay) ||
    /\brail\b/.test(hay) ||
    /\broad\b/.test(hay)
  );
}

export function isWorkwearExclusiveBrandRow(item: CategoryBrowseProductRow): boolean {
  const dncPpeMeta = {
    slug: item.slug ?? null,
    category: item.category ?? null,
    description: item.description ?? null,
    supplier_name: item.supplier_name ?? null,
  };
  if (isDncPpeGloveExclusiveListing(item.name, dncPpeMeta)) {
    return false;
  }
  if (isDncPpeSafetyGlassesExclusiveListing(item.name, dncPpeMeta)) {
    return false;
  }
  if (isBizCollectionListing(item.name, item.slug ?? null, item.category ?? null)) {
    return false;
  }
  if (
    isAussiePacificCatalogListing(item.name, {
      slug: item.slug ?? null,
      supplier_name: item.supplier_name ?? null,
    })
  ) {
    return false;
  }
  const b = inferredWorkwearExclusiveBrand(item).toLowerCase();
  if (b === "syzmik" || b === "bisley") {
    return true;
  }
  if (b === "jb's wear") {
    if (isJbWorkwearExcludedHeadwearOrSocks(item.name, { category: item.category ?? null })) {
      return false;
    }
    return (
      isJbWearSixSeriesListing(item.name, {
        slug: item.slug ?? null,
        supplier_name: item.supplier_name ?? null,
      }) || jbLooksHiVis(item)
    );
  }
  return looksWorkwearKeywordListing(item);
}

/** `/categories/workwear` main grid — Syzmik/Bisley/JB exclusivity (not `filterProductsForMainCategoryBrowse`). */
export function filterWorkwearExclusiveMainBrowseRows(
  allRows: readonly CategoryBrowseProductRow[],
): CategoryBrowseProductRow[] {
  return allRows.filter(
    (item) =>
      !item.storefront_hidden &&
      isWorkwearExclusiveBrandRow(item) &&
      hasStorefrontListNameAndPrice(item.name, item.base_price),
  );
}

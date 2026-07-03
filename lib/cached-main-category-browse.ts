import { unstable_cache } from "next/cache";

import type { CategoryBrowseProductRow } from "@/lib/main-category-browse";
import {
  filterProductsForMainCategoryBrowse,
  filterProductsForSubCategoryBrowse,
} from "@/lib/main-category-browse";
import { resolveProductSubSlug } from "@/lib/product-subslug";
import { filterWorkwearExclusiveMainBrowseRows } from "@/lib/workwear-exclusive-main-browse";

import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";

type CachedBrowseFn = () => Promise<CategoryBrowseProductRow[]>;

const mainBrowseCacheBySlug = new Map<string, CachedBrowseFn>();
const subBrowseCacheByKey = new Map<string, CachedBrowseFn>();

function subBrowseCacheKey(mainSlug: string, subSlug: string) {
  return `${mainSlug}:${subSlug}`;
}

function isProductionBrowseCacheEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

function cachedMainBrowseFilter(mainSlug: string): CachedBrowseFn {
  const existing = mainBrowseCacheBySlug.get(mainSlug);
  if (existing) {
    return existing;
  }
  const fn = unstable_cache(
    async () => {
      const allRows = await getCachedActiveProductsBrowseRows();
      return filterProductsForMainCategoryBrowse(mainSlug, allRows);
    },
    ["storefront-main-browse-filter-v2", mainSlug],
    {
      revalidate: 60,
      tags: ["storefront-products-browse"],
    },
  );
  mainBrowseCacheBySlug.set(mainSlug, fn);
  return fn;
}

const cachedWorkwearExclusiveMainBrowse = unstable_cache(
  async () => {
    const allRows = await getCachedActiveProductsBrowseRows();
    return filterWorkwearExclusiveMainBrowseRows(allRows);
  },
  ["storefront-workwear-exclusive-main-browse-v1"],
  {
    revalidate: 60,
    tags: ["storefront-products-browse"],
  },
);

function cachedSubBrowseFilter(mainSlug: string, subSlug: string): CachedBrowseFn {
  const key = subBrowseCacheKey(mainSlug, subSlug);
  const existing = subBrowseCacheByKey.get(key);
  if (existing) {
    return existing;
  }
  const fn = unstable_cache(
    async () => {
      const allRows = await getCachedActiveProductsBrowseRows();
      return filterProductsForSubCategoryBrowse(mainSlug, subSlug, allRows);
    },
    ["storefront-sub-browse-filter-v2", mainSlug, subSlug],
    {
      revalidate: 60,
      tags: ["storefront-products-browse"],
    },
  );
  subBrowseCacheByKey.set(key, fn);
  return fn;
}

const cachedCatalogHasMappedProducts = unstable_cache(
  async () => {
    const allRows = await getCachedActiveProductsBrowseRows();
    return allRows.some(
      (item) => resolveProductSubSlug(item.name, item.category, item.slug, item.description) != null,
    );
  },
  ["storefront-catalog-has-mapped-products-v1"],
  {
    revalidate: 60,
    tags: ["storefront-products-browse"],
  },
);

async function mainCategoryFilteredRowsUncached(mainSlug: string): Promise<CategoryBrowseProductRow[]> {
  const allRows = await getCachedActiveProductsBrowseRows();
  return filterProductsForMainCategoryBrowse(mainSlug, allRows);
}

async function subCategoryFilteredRowsUncached(
  mainSlug: string,
  subSlug: string,
): Promise<CategoryBrowseProductRow[]> {
  const allRows = await getCachedActiveProductsBrowseRows();
  return filterProductsForSubCategoryBrowse(mainSlug, subSlug, allRows);
}

async function workwearExclusiveMainRowsUncached(): Promise<CategoryBrowseProductRow[]> {
  const allRows = await getCachedActiveProductsBrowseRows();
  return filterWorkwearExclusiveMainBrowseRows(allRows);
}

async function catalogHasMappedProductsUncached(): Promise<boolean> {
  const allRows = await getCachedActiveProductsBrowseRows();
  return allRows.some(
    (item) => resolveProductSubSlug(item.name, item.category, item.slug, item.description) != null,
  );
}

/** Main category grids: cache the heavy 3k-row visibility filter (~60s). */
export async function getCachedMainCategoryFilteredRows(
  mainSlug: string,
): Promise<CategoryBrowseProductRow[]> {
  if (isProductionBrowseCacheEnabled()) {
    return cachedMainBrowseFilter(mainSlug)();
  }
  return mainCategoryFilteredRowsUncached(mainSlug);
}

/** `/categories/workwear` main grid — separate exclusivity rules, same cache TTL. */
export async function getCachedWorkwearExclusiveMainBrowseRows(): Promise<CategoryBrowseProductRow[]> {
  if (isProductionBrowseCacheEnabled()) {
    return cachedWorkwearExclusiveMainBrowse();
  }
  return workwearExclusiveMainRowsUncached();
}

/** Subcategory grids — cached filter pass for every main category. */
export async function getCachedSubCategoryFilteredRows(
  mainSlug: string,
  subSlug: string,
): Promise<CategoryBrowseProductRow[]> {
  if (isProductionBrowseCacheEnabled()) {
    return cachedSubBrowseFilter(mainSlug, subSlug)();
  }
  return subCategoryFilteredRowsUncached(mainSlug, subSlug);
}

/** Empty-state helper — avoids scanning all rows on every category page render. */
export async function getCachedCatalogHasMappedProducts(): Promise<boolean> {
  if (isProductionBrowseCacheEnabled()) {
    return cachedCatalogHasMappedProducts();
  }
  return catalogHasMappedProductsUncached();
}

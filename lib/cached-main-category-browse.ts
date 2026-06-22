import { unstable_cache } from "next/cache";

import type { CategoryBrowseProductRow } from "@/lib/main-category-browse";
import {
  filterProductsForMainCategoryBrowse,
  filterProductsForSubCategoryBrowse,
} from "@/lib/main-category-browse";

import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";

const GENDER_MAIN_SLUGS = new Set(["mens", "womens"]);

type CachedBrowseFn = () => Promise<CategoryBrowseProductRow[]>;

const mainBrowseCacheBySlug = new Map<string, CachedBrowseFn>();
const subBrowseCacheByKey = new Map<string, CachedBrowseFn>();

function subBrowseCacheKey(mainSlug: string, subSlug: string) {
  return `${mainSlug}:${subSlug}`;
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
    ["storefront-main-browse-filter-v1", mainSlug],
    {
      revalidate: 60,
      tags: ["storefront-products-browse"],
    },
  );
  mainBrowseCacheBySlug.set(mainSlug, fn);
  return fn;
}

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
    ["storefront-sub-browse-filter-v1", mainSlug, subSlug],
    {
      revalidate: 60,
      tags: ["storefront-products-browse"],
    },
  );
  subBrowseCacheByKey.set(key, fn);
  return fn;
}

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

/**
 * Men's / Women's main grids: cache the heavy 3k-row visibility filter (~60s).
 * Other categories keep filtering inline (smaller result sets, fast enough).
 */
export async function getCachedMainCategoryFilteredRows(
  mainSlug: string,
): Promise<CategoryBrowseProductRow[]> {
  if (GENDER_MAIN_SLUGS.has(mainSlug) && process.env.NODE_ENV === "production") {
    return cachedMainBrowseFilter(mainSlug)();
  }
  return mainCategoryFilteredRowsUncached(mainSlug);
}

/** Men's / Women's subcategory grids — same cached filter pass. */
export async function getCachedSubCategoryFilteredRows(
  mainSlug: string,
  subSlug: string,
): Promise<CategoryBrowseProductRow[]> {
  if (GENDER_MAIN_SLUGS.has(mainSlug) && process.env.NODE_ENV === "production") {
    return cachedSubBrowseFilter(mainSlug, subSlug)();
  }
  return subCategoryFilteredRowsUncached(mainSlug, subSlug);
}

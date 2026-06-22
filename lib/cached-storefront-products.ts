import { unstable_cache } from "next/cache";

import type { CategoryBrowseProductRow } from "@/lib/main-category-browse";
import { fetchActiveProductsBrowseRowsUncached } from "@/lib/storefront-catalog-fetch";

let devCache:
  | {
      fetchedAtMs: number;
      promise: Promise<CategoryBrowseProductRow[]>;
    }
  | null = null;

const cachedFetchActiveProductsBrowseRowsProd = unstable_cache(
  fetchActiveProductsBrowseRowsUncached,
  ["storefront-active-products-browse-v22"],
  {
    revalidate: 60,
    tags: ["storefront-products-browse"],
  },
);

/**
 * Single Supabase round-trip for all storefront category grids + home showcase filtering.
 * Cached ~60s. Throws on missing/invalid Supabase env (no silent empty catalog).
 */
export const getCachedActiveProductsBrowseRows = async (): Promise<CategoryBrowseProductRow[]> => {
  if (process.env.NODE_ENV !== "development") {
    return cachedFetchActiveProductsBrowseRowsProd();
  }

  const ttlMs = 10_000;
  const now = Date.now();
  if (devCache && now - devCache.fetchedAtMs < ttlMs) {
    return devCache.promise;
  }

  const promise = fetchActiveProductsBrowseRowsUncached();
  devCache = { fetchedAtMs: now, promise };
  return promise;
};

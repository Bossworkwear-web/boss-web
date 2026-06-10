import { unstable_cache } from "next/cache";

import type { CategoryBrowseProductRow } from "@/lib/main-category-browse";
import { createSupabaseClient } from "@/lib/supabase";

let devCache:
  | {
      fetchedAtMs: number;
      promise: Promise<CategoryBrowseProductRow[]>;
    }
  | null = null;

/**
 * Single Supabase round-trip for all storefront category grids + home showcase filtering.
 * Cached ~60s so concurrent navigations reuse one payload (home uses `revalidate = 60`).
 */
async function fetchActiveProductsBrowseRows(): Promise<CategoryBrowseProductRow[]> {
  let supabase: ReturnType<typeof createSupabaseClient>;
  try {
    supabase = createSupabaseClient();
  } catch {
    // Missing NEXT_PUBLIC_SUPABASE_* — same resilience as home `getStorefrontShowcaseProducts`.
    return [];
  }
  const pageSize = Math.max(100, Number(process.env.STOREFRONT_BROWSE_PAGE_SIZE ?? 500));
  const maxScan = Math.max(pageSize, Number(process.env.STOREFRONT_BROWSE_MAX_SCAN ?? 6_000));
  const selectWithAudience =
    "id, name, base_price, sale_price, image_urls, category, slug, description, storefront_hidden, audience, supplier_name, available_colors, available_sizes";
  const selectWithoutAudience =
    "id, name, base_price, sale_price, image_urls, category, slug, description, storefront_hidden, supplier_name, available_colors, available_sizes";
  const selectBare =
    "id, name, base_price, sale_price, image_urls, category, slug, description, storefront_hidden, available_colors, available_sizes";

  function withoutSalePrice(select: string): string {
    return select
      .replace(/,\s*sale_price\s*,/i, ", ")
      .replace(/,\s*sale_price\s*$/i, "")
      .replace(/^\s*sale_price\s*,\s*/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/,\s*,/g, ",")
      .trim();
  }

  async function fetchAll(select: string): Promise<{ data: CategoryBrowseProductRow[]; error: unknown }> {
    const out: CategoryBrowseProductRow[] = [];
    for (let offset = 0; offset < maxScan; offset += pageSize) {
      const res = await supabase
        .from("products")
        .select(select)
        .eq("is_active", true)
        // Hidden products should never be in storefront browse payload.
        .neq("storefront_hidden", true)
        .order("name")
        .range(offset, offset + pageSize - 1);
      if (res.error) {
        return { data: [], error: res.error };
      }
      const chunk = (res.data ?? []) as unknown as CategoryBrowseProductRow[];
      out.push(...chunk);
      if (chunk.length < pageSize) {
        break;
      }
    }
    return { data: out, error: null };
  }

  const primary = await fetchAll(selectWithAudience);

  if (primary.error) {
    const msg = String((primary.error as { message?: unknown } | null)?.message ?? primary.error).toLowerCase();
    const missingAudience = msg.includes("audience");
    const missingSupplierName = msg.includes("supplier_name");
    const missingImageUrls = msg.includes("image_urls");
    const missingSalePrice = msg.includes("sale_price");

    const fallbackSelect = missingSupplierName
      ? missingAudience
        ? selectBare
        : selectBare.replace("storefront_hidden", "storefront_hidden, audience")
      : missingAudience
        ? missingImageUrls
          ? "id, name, base_price, sale_price, category, slug, description, storefront_hidden, supplier_name, available_colors, available_sizes"
          : selectWithoutAudience
        : missingImageUrls
          ? "id, name, base_price, sale_price, category, slug, description, storefront_hidden, audience, supplier_name, available_colors, available_sizes"
          : selectWithAudience;

    const secondary = await fetchAll(missingSalePrice ? withoutSalePrice(fallbackSelect) : fallbackSelect);

    const data = (secondary.data ?? []) as unknown as CategoryBrowseProductRow[];
    // Preserve image_urls when the fallback select still includes it.
    const effectiveSelect = missingSalePrice ? withoutSalePrice(fallbackSelect) : fallbackSelect;
    if (effectiveSelect.includes("image_urls")) {
      return data;
    }
    return data.map((r) => ({ ...r, image_urls: null }));
  }

  const rows = primary.data ?? [];
  // If `audience` column exists, we have it; if not, we still got rows.
  if (rows.length === 0) {
    // Some environments may have image_urls missing or restricted; keep page usable.
    const minimalSelect =
      "id, name, base_price, sale_price, category, slug, description, storefront_hidden, available_colors, available_sizes";
    const minimal = await fetchAll(minimalSelect);
    if (minimal.error) {
      const msg = String((minimal.error as { message?: unknown } | null)?.message ?? minimal.error).toLowerCase();
      if (msg.includes("sale_price")) {
        const fallback = await fetchAll(withoutSalePrice(minimalSelect));
        return (fallback.data ?? []).map((r) => ({ ...r, image_urls: null }));
      }
    }
    return (minimal.data ?? []).map((r) => ({ ...r, image_urls: null }));
  }

  return rows as CategoryBrowseProductRow[];
}

const cachedFetchActiveProductsBrowseRowsProd = unstable_cache(
  fetchActiveProductsBrowseRows,
  ["storefront-active-products-browse-v16"],
  {
    revalidate: 60,
    tags: ["storefront-products-browse"],
  },
);

export const getCachedActiveProductsBrowseRows = async (): Promise<CategoryBrowseProductRow[]> => {
  if (process.env.NODE_ENV !== "development") {
    return cachedFetchActiveProductsBrowseRowsProd();
  }

  // Dev: avoid Next.js data cache 2MB limit; use in-process cache.
  const ttlMs = 10_000;
  const now = Date.now();
  if (devCache && now - devCache.fetchedAtMs < ttlMs) {
    return devCache.promise;
  }

  const promise = fetchActiveProductsBrowseRows();
  devCache = { fetchedAtMs: now, promise };
  return promise;
};

import { unstable_cache } from "next/cache";

import type { CategoryBrowseProductRow } from "@/lib/main-category-browse";
import { createSupabaseClient } from "@/lib/supabase";

/**
 * Single Supabase round-trip for all storefront category grids + home showcase filtering.
 * Cached ~60s so concurrent navigations reuse one payload (still `force-dynamic` pages).
 */
async function fetchActiveProductsBrowseRows(): Promise<CategoryBrowseProductRow[]> {
  const supabase = createSupabaseClient();
  const selectWithAudience =
    "id, name, base_price, image_urls, category, slug, description, storefront_hidden, audience, supplier_name, available_colors, available_sizes";
  const selectWithoutAudience =
    "id, name, base_price, image_urls, category, slug, description, storefront_hidden, supplier_name, available_colors, available_sizes";
  const selectBare =
    "id, name, base_price, image_urls, category, slug, description, storefront_hidden, available_colors, available_sizes";

  async function fetchAll(select: string): Promise<{ data: CategoryBrowseProductRow[]; error: unknown }> {
    const pageSize = 1000;
    const maxScan = 25_000;
    const out: CategoryBrowseProductRow[] = [];
    for (let offset = 0; offset < maxScan; offset += pageSize) {
      const res = await supabase
        .from("products")
        .select(select)
        .eq("is_active", true)
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
    const msg = String(primary.error.message ?? primary.error).toLowerCase();
    const missingAudience = msg.includes("audience");
    const missingSupplierName = msg.includes("supplier_name");
    const missingImageUrls = msg.includes("image_urls");

    const fallbackSelect = missingSupplierName
      ? missingAudience
        ? selectBare
        : selectBare.replace("storefront_hidden", "storefront_hidden, audience")
      : missingAudience
        ? missingImageUrls
          ? "id, name, base_price, category, slug, description, storefront_hidden, supplier_name, available_colors, available_sizes"
          : selectWithoutAudience
        : missingImageUrls
          ? "id, name, base_price, category, slug, description, storefront_hidden, audience, supplier_name, available_colors, available_sizes"
          : selectWithAudience;

    const secondary = await fetchAll(fallbackSelect);

    const data = (secondary.data ?? []) as unknown as CategoryBrowseProductRow[];
    // Preserve image_urls when the fallback select still includes it.
    if (fallbackSelect.includes("image_urls")) {
      return data;
    }
    return data.map((r) => ({ ...r, image_urls: null }));
  }

  const rows = primary.data ?? [];
  // If `audience` column exists, we have it; if not, we still got rows.
  if (rows.length === 0) {
    // Some environments may have image_urls missing or restricted; keep page usable.
    const minimal = await fetchAll(
      "id, name, base_price, category, slug, description, storefront_hidden, available_colors, available_sizes",
    );
    return (minimal.data ?? []).map((r) => ({ ...r, image_urls: null }));
  }

  return rows as CategoryBrowseProductRow[];
}

export const getCachedActiveProductsBrowseRows =
  process.env.NODE_ENV === "development"
    ? fetchActiveProductsBrowseRows
    : unstable_cache(fetchActiveProductsBrowseRows, ["storefront-active-products-browse-v12"], {
        revalidate: 60,
      });

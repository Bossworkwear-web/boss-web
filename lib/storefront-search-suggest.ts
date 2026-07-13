import { productCardDisplayLines } from "@/lib/product-card-copy";
import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";
import { scoreProductSearchMatch } from "@/lib/product-search";
import { productPathSegment } from "@/lib/product-path-slug";
import { isProductEligibleForSiteSearch } from "@/lib/product-visibility";
import { resolveStorefrontImageUrl } from "@/lib/storefront-image-url";

export type StorefrontSearchSuggestItem = {
  id: string;
  name: string;
  displayName: string;
  styleCode: string | null;
  href: string;
  imageUrl: string | null;
  category: string | null;
  supplierName: string | null;
  score: number;
};

const MIN_QUERY_LEN = 2;
const DEFAULT_LIMIT = 8;

/**
 * Ranked top-N storefront search suggestions (shared by `/api/storefront/search-suggest`
 * and any server callers).
 */
export async function getStorefrontSearchSuggestions(
  rawQuery: string,
  limit = DEFAULT_LIMIT,
): Promise<StorefrontSearchSuggestItem[]> {
  const q = rawQuery.trim();
  if (q.length < MIN_QUERY_LEN) {
    return [];
  }

  const rows = await getCachedActiveProductsBrowseRows();
  const scored: StorefrontSearchSuggestItem[] = [];

  for (const product of rows) {
    if (
      !isProductEligibleForSiteSearch(product.name, {
        storefront_hidden: product.storefront_hidden,
        slug: product.slug ?? null,
        category: product.category ?? null,
      })
    ) {
      continue;
    }

    const score = scoreProductSearchMatch(
      product.name,
      product.slug ?? null,
      product.category ?? null,
      q,
      product.description ?? null,
      product.id,
      {
        supplierName: product.supplier_name ?? null,
        colors: product.available_colors ?? null,
        sizes: product.available_sizes ?? null,
      },
    );
    if (score <= 0) {
      continue;
    }

    const card = productCardDisplayLines(
      product.name,
      product.description,
      product.slug,
      product.supplier_name,
      product.available_colors,
      true,
    );
    const pathSlug = productPathSegment({ name: product.name, slug: product.slug ?? null });
    const rawImage = Array.isArray(product.image_urls) ? product.image_urls[0] : null;
    const imageUrl = rawImage ? resolveStorefrontImageUrl(String(rawImage)) || String(rawImage) : null;

    scored.push({
      id: product.id,
      name: product.name.trim(),
      displayName: card.productName?.trim() || product.name.trim(),
      styleCode: card.productCode?.trim() ? card.productCode.trim().toUpperCase() : null,
      href: `/products/${encodeURIComponent(pathSlug)}`,
      imageUrl,
      category: product.category?.trim() || null,
      supplierName: product.supplier_name?.trim() || null,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
  return scored.slice(0, Math.max(1, Math.min(20, limit)));
}

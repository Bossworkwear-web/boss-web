import { productCardDisplayLines } from "@/lib/product-card-copy";
import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";
import { productMatchesSearchQuery } from "@/lib/product-search";
import { isProductEligibleForSiteSearch } from "@/lib/product-visibility";

export const QUOTE_PRODUCT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type QuoteCatalogProduct = {
  id: string;
  name: string;
  displayName: string;
  styleCode: string | null;
  slug: string | null;
  category: string | null;
  description: string | null;
  supplierName: string | null;
  availableColors: string[];
  imageUrls: string[];
};

export function normalizeQuoteStyleCodeQuery(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_-]+/g, "");
}

export function mapRowToQuoteCatalogProduct(row: {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  description: string | null;
  supplier_name: string | null;
  available_colors: string[] | null;
  image_urls?: string[] | null;
}): QuoteCatalogProduct {
  const card = productCardDisplayLines(
    row.name,
    row.description,
    row.slug,
    row.supplier_name,
    row.available_colors,
    true,
  );

  return {
    id: row.id,
    name: row.name.trim(),
    displayName: card.productName?.trim() || row.name.trim(),
    styleCode: card.productCode?.trim() ? card.productCode.trim().toUpperCase() : null,
    slug: row.slug?.trim() ? row.slug.trim() : null,
    category: row.category?.trim() ? row.category.trim() : null,
    description: row.description?.trim() ? row.description.trim() : null,
    supplierName: row.supplier_name?.trim() ? row.supplier_name.trim() : null,
    availableColors: (row.available_colors ?? []).map((color) => color.trim()).filter(Boolean),
    imageUrls: (row.image_urls ?? []).map((url) => url.trim()).filter(Boolean),
  };
}

export function findQuoteCatalogProduct(
  catalog: QuoteCatalogProduct[],
  productId: string | null | undefined,
): QuoteCatalogProduct | null {
  const id = productId?.trim();
  if (!id) {
    return null;
  }
  return catalog.find((product) => product.id === id) ?? null;
}

export function isQuoteProductUuid(value: string): boolean {
  return QUOTE_PRODUCT_UUID_RE.test(value.trim());
}

export function findQuoteCatalogProductByUuid(
  catalog: QuoteCatalogProduct[],
  raw: string,
): QuoteCatalogProduct | null {
  const query = raw.trim();
  if (!query) {
    return null;
  }
  return catalog.find((product) => product.id.toLowerCase() === query.toLowerCase()) ?? null;
}

export function findQuoteCatalogProductByStyleCode(
  catalog: QuoteCatalogProduct[],
  raw: string,
): QuoteCatalogProduct | null {
  const query = normalizeQuoteStyleCodeQuery(raw);
  if (!query) {
    return null;
  }
  return catalog.find((product) => product.styleCode && normalizeQuoteStyleCodeQuery(product.styleCode) === query) ?? null;
}

function dedupeQuoteCatalogProducts(products: QuoteCatalogProduct[]): QuoteCatalogProduct[] {
  const seen = new Set<string>();
  const out: QuoteCatalogProduct[] = [];
  for (const product of products) {
    if (seen.has(product.id)) {
      continue;
    }
    seen.add(product.id);
    out.push(product);
  }
  return out;
}

function productMatchesQuoteCatalogQuery(product: QuoteCatalogProduct, query: string): boolean {
  if (
    productMatchesSearchQuery(
      product.name,
      product.slug,
      product.category,
      query,
      product.description,
      product.id,
    )
  ) {
    return true;
  }

  const compactQuery = normalizeQuoteStyleCodeQuery(query);
  if (compactQuery.length < 2) {
    return false;
  }

  if (product.styleCode && normalizeQuoteStyleCodeQuery(product.styleCode).includes(compactQuery)) {
    return true;
  }

  if (product.displayName.toLowerCase().includes(query.trim().toLowerCase())) {
    return true;
  }

  return false;
}

/** Keep catalog link when the field still shows the selected name, display title, style code, or UUID. */
export function resolveQuoteProductLink(
  catalog: QuoteCatalogProduct[],
  spec: string,
  currentProductId: string | null,
): string | null {
  const trimmed = spec.trim();
  if (!trimmed) {
    return null;
  }

  const uuidMatch = findQuoteCatalogProductByUuid(catalog, trimmed);
  if (uuidMatch) {
    return uuidMatch.id;
  }

  const styleMatch = findQuoteCatalogProductByStyleCode(catalog, trimmed);
  if (styleMatch) {
    return styleMatch.id;
  }

  if (!currentProductId) {
    return null;
  }

  const current = findQuoteCatalogProduct(catalog, currentProductId);
  if (!current) {
    return null;
  }

  const compactTrimmed = normalizeQuoteStyleCodeQuery(trimmed);
  if (
    trimmed === current.name.trim() ||
    trimmed === current.displayName.trim() ||
    trimmed.toLowerCase() === current.id.toLowerCase() ||
    (current.styleCode && compactTrimmed === normalizeQuoteStyleCodeQuery(current.styleCode))
  ) {
    return current.id;
  }

  return null;
}

export function searchQuoteCatalogProducts(
  catalog: QuoteCatalogProduct[],
  query: string,
  limit = 8,
): QuoteCatalogProduct[] {
  const q = query.trim();
  if (!q) {
    return [];
  }

  const compactQuery = normalizeQuoteStyleCodeQuery(q);
  const exactUuidMatch = findQuoteCatalogProductByUuid(catalog, q);
  const exactStyleMatch = findQuoteCatalogProductByStyleCode(catalog, q);
  const stylePrefixMatches =
    compactQuery.length >= 2
      ? catalog.filter(
          (product) =>
            product.styleCode && normalizeQuoteStyleCodeQuery(product.styleCode).startsWith(compactQuery),
        )
      : [];
  const generalMatches = catalog.filter((product) => productMatchesQuoteCatalogQuery(product, q));

  return dedupeQuoteCatalogProducts([
    ...(exactStyleMatch ? [exactStyleMatch] : []),
    ...(exactUuidMatch ? [exactUuidMatch] : []),
    ...stylePrefixMatches,
    ...generalMatches,
  ]).slice(0, limit);
}

/** Full active storefront catalog for quote autocomplete (paginated; not limited to 1000 rows). */
export async function getQuoteCatalogProducts(): Promise<QuoteCatalogProduct[]> {
  const rows = await getCachedActiveProductsBrowseRows();
  return rows
    .filter((product) =>
      isProductEligibleForSiteSearch(product.name, {
        storefront_hidden: product.storefront_hidden,
        slug: product.slug ?? null,
        category: product.category ?? null,
      }),
    )
    .map((product) =>
      mapRowToQuoteCatalogProduct({
        id: product.id,
        name: product.name,
        slug: product.slug ?? null,
        category: product.category ?? null,
        description: product.description ?? null,
        supplier_name: product.supplier_name ?? null,
        available_colors: product.available_colors ?? null,
        image_urls: product.image_urls ?? null,
      }),
    );
}

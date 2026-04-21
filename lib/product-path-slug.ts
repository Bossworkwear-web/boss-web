/** Slug segment used in `/products/[slug]` when no store slug is set. */
export function slugifyProductNameForPath(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-");
}

/**
 * Prefer persisted `products.slug` (e.g. Fashion Biz `fb-syzmik-zj263`);
 * otherwise derive from display name.
 */
export function productPathSegment(product: { name: string; slug?: string | null }): string {
  const s = product.slug?.trim();
  if (s) {
    return s;
  }
  return slugifyProductNameForPath(product.name);
}

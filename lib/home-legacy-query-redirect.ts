import { MAIN_CATEGORIES } from "@/lib/catalog";

const MAIN_CATEGORY_SLUGS = new Set(MAIN_CATEGORIES.map((c) => c.slug));

/**
 * Legacy `/?q=` and `/?category=` URLs → canonical routes (handled in middleware so `/` can be cached).
 */
export function homeLegacyQueryRedirectUrl(searchParams: URLSearchParams): string | null {
  const q = searchParams.get("q")?.trim();
  if (q) {
    const url = new URLSearchParams();
    url.set("q", q);
    return `/search?${url.toString()}`;
  }

  const category = searchParams.get("category")?.trim();
  if (category && MAIN_CATEGORY_SLUGS.has(category as (typeof MAIN_CATEGORIES)[number]["slug"])) {
    return `/categories/${encodeURIComponent(category)}`;
  }

  return null;
}

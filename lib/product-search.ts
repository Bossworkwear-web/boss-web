import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import { storefrontProductNameWithoutBrand } from "@/lib/product-display-name";

/**
 * Home / nav search: match product `name`, URL `slug` segments, Fashion Biz style code from name/slug,
 * and brand-stripped display tail (e.g. `Syzmik ZH145` → `ZH145`).
 */
export function productMatchesSearchQuery(
  name: string,
  slug: string | null | undefined,
  category: string | null | undefined,
  rawQuery: string,
): boolean {
  const q = rawQuery.trim();
  if (!q) {
    return true;
  }
  const qLower = q.toLowerCase();
  const stripped = storefrontProductNameWithoutBrand(name);
  const listingCode = fashionBizStyleCodeFromListing(name, slug ?? null);

  const parts: string[] = [name, stripped, category ?? "", slug ?? ""];
  if (listingCode) {
    parts.push(listingCode);
  }
  if (slug) {
    for (const seg of slug.split(/[-_]+/)) {
      if (seg.length > 0) {
        parts.push(seg);
      }
    }
  }

  const haystack = parts.join(" ").toLowerCase();
  if (haystack.includes(qLower)) {
    return true;
  }

  const compactQ = q.replace(/[\s_-]+/g, "").toUpperCase();
  if (compactQ.length < 2) {
    return false;
  }

  const blob = [name, stripped, slug ?? "", listingCode ?? ""].join(" ").toUpperCase();
  const compactBlob = blob.replace(/[\s_-]+/g, "");
  if (compactBlob.includes(compactQ)) {
    return true;
  }

  const slugFlat = (slug ?? "").toUpperCase().replace(/[-_]/g, "");
  return slugFlat.includes(compactQ);
}

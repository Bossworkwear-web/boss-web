import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import { resolveStorefrontImageUrl } from "@/lib/storefront-image-url";

/** Placeholder hero images when a product row has no `image_urls` — aligned with category browse grids. */
export const DEFAULT_IMAGE_BY_SUB: Record<string, string> = {
  "t-shirts": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80",
  tops: "https://images.unsplash.com/photo-1612532275214-e4ca76d0e4d1?auto=format&fit=crop&w=1600&q=80",
  polos: "https://images.unsplash.com/photo-1592878940526-0214b0f374f6?auto=format&fit=crop&w=1600&q=80",
  shirts: "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1600&q=80",
  "work-shirts": "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1600&q=80",
  jackets: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1600&q=80",
  jumper: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1600&q=80",
  pants: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1600&q=80",
  coverall: "https://images.unsplash.com/photo-1584308666744-24d5cfdc7ae8?auto=format&fit=crop&w=1600&q=80",
  scrubs: "https://images.unsplash.com/photo-1612532275214-e4ca76d0e4d1?auto=format&fit=crop&w=1600&q=80",
  chef: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80",
  apron: "https://images.unsplash.com/photo-1604909052743-94e9cf232b2b?auto=format&fit=crop&w=1600&q=80",
  boots: "https://images.unsplash.com/photo-1542281286-9e0a16bb7368?auto=format&fit=crop&w=1600&q=80",
  glove: "https://images.unsplash.com/photo-1584735175097-719d848f8449?auto=format&fit=crop&w=1600&q=80",
  "safty-glasses": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=1600&q=80",
  "safety-glasses": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=1600&q=80",
  "head-wear":
    "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=1600&q=80",
  "hi-vis-vest":
    "https://images.unsplash.com/photo-1584308666744-24d5cfdc7ae8?auto=format&fit=crop&w=1600&q=80",
  miscellaneous:
    "https://images.unsplash.com/photo-1584308666744-24d5cfdc7ae8?auto=format&fit=crop&w=1600&q=80",
};

export type BrowseCardImageRow = {
  name: string;
  slug?: string | null;
  image_urls?: string[] | null;
};

export function heroOverrideCardImageUrl(item: BrowseCardImageRow): string | null {
  const code = fashionBizStyleCodeFromListing(item.name, item.slug ?? null);
  if (code?.toUpperCase() === "CL542UL") {
    const want = "CL542UL_TALENT_MIDNIGHTNAVY_07.JPG";
    const hit = (item.image_urls ?? []).find((u) => String(u).toUpperCase().includes(want));
    const picked = hit?.trim() ? hit.trim() : null;
    return picked ? resolveStorefrontImageUrl(picked) : null;
  }
  return null;
}

export function categoryBrowseCardImageUrl(item: BrowseCardImageRow, resolvedSubSlug: string): string {
  const fromDb = item.image_urls?.[0];
  const resolvedDb = fromDb ? resolveStorefrontImageUrl(fromDb) : null;
  return (
    heroOverrideCardImageUrl(item) ??
    (resolvedDb && resolvedDb.length > 0 ? resolvedDb : null) ??
    DEFAULT_IMAGE_BY_SUB[resolvedSubSlug] ??
    DEFAULT_IMAGE_BY_SUB["t-shirts"]
  );
}

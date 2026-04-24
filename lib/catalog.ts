import { resolveProductSubSlug } from "@/lib/product-subslug";

import {
  filterSubCategoriesForKidsMain,
  KIDS_MAIN_CATEGORY,
  KIDS_MAIN_SLUG,
} from "@/lib/catalog-kids";

export { KIDS_MAIN_CATEGORY, KIDS_MAIN_SLUG } from "@/lib/catalog-kids";

export const HEALTH_CARE_MAIN_SLUG = "health-care" as const;

export const MAIN_CATEGORIES = [
  { slug: "workwear", label: "Workwear" },
  { slug: "mens", label: "Men's" },
  { slug: "womens", label: "Women's" },
  KIDS_MAIN_CATEGORY,
  { slug: HEALTH_CARE_MAIN_SLUG, label: "Health care" },
  { slug: "chef", label: "Chef" },
  { slug: "ppe", label: "PPE" },
  { slug: "special-offer", label: "Special Offer" },
  { slug: "clearance", label: "Clearance" },
] as const;

export const SUB_CATEGORIES = [
  { slug: "t-shirts", label: "T-shirts" },
  { slug: "tops", label: "Tops" },
  { slug: "polos", label: "Polos" },
  { slug: "shirts", label: "Shirts" },
  { slug: "jackets", label: "Jackets" },
  { slug: "jumper", label: "Jumper" },
  { slug: "pants", label: "Pants" },
  { slug: "coverall", label: "Coverall" },
  { slug: "scrubs", label: "Scrubs" },
  { slug: "chef", label: "Chef" },
  { slug: "apron", label: "Apron" },
  { slug: "boots", label: "Boots" },
  { slug: "glove", label: "Glove" },
  { slug: "safty-glasses", label: "Safty Glasses" },
  { slug: "head-wear", label: "Head Wear" },
  { slug: "hi-vis-vest", label: "Hi-vis Vest" },
  /** PPE catch-all (기타 등등) — English label for storefront */
  { slug: "miscellaneous", label: "Miscellaneous" },
] as const;

/** Sub-categories shown only under PPE, not under Men's / Women's / Kid's / Workwear. */
export const PPE_EXCLUSIVE_SUB_SLUGS: readonly string[] = [
  "boots",
  "glove",
  "safty-glasses",
  "head-wear",
  "miscellaneous",
];

const PPE_EXCLUSIVE_SET = new Set(PPE_EXCLUSIVE_SUB_SLUGS);

export function getMainCategory(slug: string) {
  return MAIN_CATEGORIES.find((item) => item.slug === slug) ?? null;
}

/** Plain objects for passing storefront sub-nav from Server Components into `TopNav` (avoids SSR/client catalog drift). */
export type StorefrontNavSub = { slug: string; label: string };

export function buildNavSubcategoriesByMain(): Record<string, StorefrontNavSub[]> {
  const out: Record<string, StorefrontNavSub[]> = {};
  for (const main of MAIN_CATEGORIES) {
    out[main.slug] = getSubCategoriesForMain(main.slug).map((s) => ({ slug: s.slug, label: s.label }));
  }
  return out;
}

export function getSubCategoriesForMain(mainSlug: string) {
  if (mainSlug === HEALTH_CARE_MAIN_SLUG) {
    const wanted = new Set(["tops", "pants", "miscellaneous"]);
    return SUB_CATEGORIES.filter((item) => wanted.has(item.slug));
  }
  if (mainSlug === "workwear") {
    return SUB_CATEGORIES.filter(
      (item) =>
        item.slug !== "scrubs" &&
        item.slug !== "tops" &&
        item.slug !== "chef" &&
        item.slug !== "apron" &&
        (!PPE_EXCLUSIVE_SET.has(item.slug) || item.slug === "head-wear" || item.slug === "miscellaneous"),
    );
  }
  if (mainSlug === "chef") {
    const wanted = new Set(["jackets", "pants", "apron", "miscellaneous"]);
    return SUB_CATEGORIES.filter((item) => wanted.has(item.slug)).map((item) =>
      item.slug === "jackets" ? { ...item, label: "Tops" } : item,
    );
  }
  if (mainSlug === "mens" || mainSlug === "womens") {
    return SUB_CATEGORIES.filter(
      (item) =>
        item.slug !== "chef" &&
        item.slug !== "apron" &&
        item.slug !== "hi-vis-vest" &&
        item.slug !== "coverall" &&
        item.slug !== "scrubs" &&
        item.slug !== "tops" &&
        !PPE_EXCLUSIVE_SET.has(item.slug),
    );
  }
  if (mainSlug === KIDS_MAIN_SLUG) {
    return filterSubCategoriesForKidsMain(SUB_CATEGORIES, PPE_EXCLUSIVE_SUB_SLUGS);
  }
  if (mainSlug === "ppe") {
    return SUB_CATEGORIES.filter((item) => PPE_EXCLUSIVE_SET.has(item.slug));
  }
  if (mainSlug === "special-offer" || mainSlug === "clearance") {
    return [];
  }
  return SUB_CATEGORIES;
}

/** Product detail: only PPE-exclusive subs (boots, gloves, misc, …) — Plain-only service on PDP. */
export function isPpeStorefrontProduct(
  name: string,
  category?: string | null,
  slug?: string | null,
  description?: string | null,
): boolean {
  const sub = resolveProductSubSlug(name, category, slug, description);
  return sub != null && PPE_EXCLUSIVE_SET.has(sub);
}

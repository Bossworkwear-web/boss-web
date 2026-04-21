import { resolveProductSubSlug } from "@/lib/product-subslug";

import {
  filterSubCategoriesForKidsMain,
  KIDS_MAIN_CATEGORY,
  KIDS_MAIN_SLUG,
} from "@/lib/catalog-kids";

export { KIDS_MAIN_CATEGORY, KIDS_MAIN_SLUG } from "@/lib/catalog-kids";

export const MAIN_CATEGORIES = [
  { slug: "workwear", label: "Workwear" },
  { slug: "mens", label: "Men's" },
  { slug: "womens", label: "Women's" },
  KIDS_MAIN_CATEGORY,
  { slug: "ppe", label: "PPE" },
  { slug: "chef", label: "Chef" },
  { slug: "special-offer", label: "Special Offer" },
  { slug: "clearance", label: "Clearance" },
] as const;

export const SUB_CATEGORIES = [
  { slug: "t-shirts", label: "T-shirts" },
  { slug: "polos", label: "Polos" },
  { slug: "shirts", label: "Shirts" },
  { slug: "jackets", label: "Jackets" },
  { slug: "jumper", label: "Jumper" },
  { slug: "pants", label: "Pants" },
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

export function getSubCategoriesForMain(mainSlug: string) {
  if (mainSlug === "workwear") {
    return SUB_CATEGORIES.filter(
      (item) =>
        item.slug !== "scrubs" &&
        item.slug !== "chef" &&
        item.slug !== "apron" &&
        (!PPE_EXCLUSIVE_SET.has(item.slug) || item.slug === "head-wear"),
    );
  }
  if (mainSlug === "chef") {
    const wanted = new Set(["jackets", "pants", "apron", "miscellaneous"]);
    return SUB_CATEGORIES.filter((item) => wanted.has(item.slug));
  }
  if (mainSlug === "mens" || mainSlug === "womens") {
    return SUB_CATEGORIES.filter(
      (item) =>
        item.slug !== "chef" &&
        item.slug !== "apron" &&
        item.slug !== "hi-vis-vest" &&
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

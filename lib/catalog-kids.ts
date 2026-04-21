/**
 * Kid's main storefront category — sub-category rules stay in sync with
 * `getSubCategoriesForMain("kids")` behaviour in `lib/catalog.ts` (PPE-exclusive subs excluded).
 */
export const KIDS_MAIN_SLUG = "kids" as const;

export const KIDS_MAIN_CATEGORY = {
  slug: KIDS_MAIN_SLUG,
  label: "Kid's",
} as const;

export function filterSubCategoriesForKidsMain<
  T extends { slug: string },
>(subs: readonly T[], ppeExclusiveSlugs: readonly string[]): T[] {
  const ppe = new Set(ppeExclusiveSlugs);
  return subs.filter(
    (item) =>
      item.slug !== "chef" &&
      item.slug !== "apron" &&
      item.slug !== "scrubs" &&
      item.slug !== "hi-vis-vest" &&
      !ppe.has(item.slug),
  );
}

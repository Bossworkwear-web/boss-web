/** Main category slugs where JB's Wear listings are shown first (default sort). */
const JBS_WEAR_PRIORITY_MAIN_SLUGS = new Set(["workwear", "mens", "womens"]);

export function isJbsWearBrandLabel(brand: string): boolean {
  const lower = brand.trim().toLowerCase();
  return (
    lower === "jb's wear" ||
    lower === "jbs wear" ||
    lower === "jbswear" ||
    /\bjbs\s*wear\b/i.test(lower)
  );
}

/** Default category browse order: JB's Wear first (on selected mains), then name A–Z. */
export function compareCategoryBrowseDefaultSort<T extends { name: string }>(
  mainSlug: string,
  a: T,
  b: T,
  brandOf: (item: T) => string,
): number {
  if (JBS_WEAR_PRIORITY_MAIN_SLUGS.has(mainSlug)) {
    const aJb = isJbsWearBrandLabel(brandOf(a));
    const bJb = isJbsWearBrandLabel(brandOf(b));
    if (aJb !== bJb) {
      return aJb ? -1 : 1;
    }
  }
  return a.name.localeCompare(b.name);
}

export function sortCategoryBrowseDefault<T extends { name: string }>(
  mainSlug: string,
  rows: T[],
  brandOf: (item: T) => string,
): T[] {
  return [...rows].sort((a, b) => compareCategoryBrowseDefaultSort(mainSlug, a, b, brandOf));
}

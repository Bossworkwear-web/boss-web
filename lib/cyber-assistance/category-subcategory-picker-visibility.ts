/** Matches `store-ui.css` — picker hidden when desktop hover sub-nav is used. */
export const CATEGORY_SUBCATEGORY_PICKER_HIDDEN_MEDIA =
  "(min-width: 1280px) and (hover: hover) and (pointer: fine)";

export const CAT_SUBCATEGORIES_GUIDE_SELECTOR = "[data-cyber-guide='cat-subcategories']";

/** True when the on-page “Shop by type” button row is shown (tablet / touch browse). */
export function isCategorySubcategoryPickerVisibleInUI(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return !window.matchMedia(CATEGORY_SUBCATEGORY_PICKER_HIDDEN_MEDIA).matches;
}

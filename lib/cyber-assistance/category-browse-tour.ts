import type { DriveStep } from "driver.js";

import {
  CAT_SUBCATEGORIES_GUIDE_SELECTOR,
  isCategorySubcategoryPickerVisibleInUI,
} from "@/lib/cyber-assistance/category-subcategory-picker-visibility";
import { filterTourSteps } from "@/lib/cyber-assistance/tour-utils";

function filterCategoryBrowseTourSteps(steps: DriveStep[]): DriveStep[] {
  const present = filterTourSteps(steps);
  if (isCategorySubcategoryPickerVisibleInUI()) {
    return present;
  }
  return present.filter((step) => {
    const el = step.element;
    return typeof el !== "string" || el !== CAT_SUBCATEGORIES_GUIDE_SELECTOR;
  });
}

const MAIN_CATEGORY_STEPS: DriveStep[] = [
  {
    element: "[data-cyber-guide='cat-header']",
    popover: {
      title: "Category browse",
      description:
        "You are shopping within a main category. Use the title area to confirm where you are, and narrow the list by brand or sort when those controls are available.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='cat-subcategories']",
    popover: {
      title: "Shop by type",
      description:
        "Use these buttons to narrow the list — for example Polos, Shirts, or Jackets. Click a button to open that group. Choose All to see every product in this category on one page.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='cat-quote']",
    popover: {
      title: "Need a quote first?",
      description:
        "Tap Email for a free quote to ask about bulk orders, decoration, or anything before you choose a product.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "[data-cyber-guide='cat-products']",
    popover: {
      title: "Product cards",
      description:
        "Each card shows the style, code, and price (GST inclusive). Click a card to open the product page where you choose colour, size, decoration, and add to cart.",
      side: "top",
      align: "center",
    },
  },
  {
    element: "[data-cyber-guide='cat-pagination']",
    popover: {
      title: "More pages",
      description: "When there are many styles, use Previous, Next, or page numbers to browse the full range without missing items.",
      side: "top",
      align: "center",
    },
  },
];

const SUBCATEGORY_STEPS: DriveStep[] = [
  {
    element: "[data-cyber-guide='cat-header']",
    popover: {
      title: "Subcategory",
      description:
        "This page lists one product type within the main category. The heading shows both the main category and the type you are viewing.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='cat-breadcrumb']",
    popover: {
      title: "Back to the full category",
      description:
        "Use the orange link to return to All styles in the main category if you want a wider browse before choosing a product.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='cat-subcategories']",
    popover: {
      title: "Shop by type",
      description:
        "These buttons change which products are listed. The dark grey button is the type you are viewing now. Click another button (for example a different shirt type) to switch lists. Click All to see every style in this category.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='cat-quote']",
    popover: {
      title: "Need a quote first?",
      description:
        "Tap Email for a free quote to ask about bulk orders, decoration, or anything before you choose a product.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "[data-cyber-guide='cat-products']",
    popover: {
      title: "Choose a product",
      description: "Open any card to start your order on the product page — colour, sizes, logo, and checkout happen there.",
      side: "top",
      align: "center",
    },
  },
  {
    element: "[data-cyber-guide='cat-pagination']",
    popover: {
      title: "Pagination",
      description: "Browse additional pages of results when this subcategory has more than one screen of products.",
      side: "top",
      align: "center",
    },
  },
];

export function buildMainCategoryTourSteps(): DriveStep[] {
  return filterCategoryBrowseTourSteps(MAIN_CATEGORY_STEPS);
}

export function buildSubcategoryTourSteps(): DriveStep[] {
  return filterCategoryBrowseTourSteps(SUBCATEGORY_STEPS);
}

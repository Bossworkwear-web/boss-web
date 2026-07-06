import { describe, expect, it } from "vitest";

import {
  filterProductsForSubCategoryBrowse,
  type CategoryBrowseProductRow,
} from "@/lib/main-category-browse";

function row(overrides: Partial<CategoryBrowseProductRow>): CategoryBrowseProductRow {
  return {
    id: overrides.id ?? overrides.slug ?? overrides.name ?? "id",
    name: "",
    base_price: 1999,
    sale_price: null,
    image_urls: ["https://cdn.example/a.jpg"],
    category: null,
    slug: null,
    description: null,
    storefront_hidden: false,
    audience: "kids",
    supplier_name: null,
    available_colors: null,
    available_sizes: null,
    ...overrides,
  };
}

const NAMES = (rows: CategoryBrowseProductRow[]) => rows.map((r) => r.name);

describe("kids browse shirts routing", () => {
  const catalog: CategoryBrowseProductRow[] = [
    row({
      name: "Kids Cool-Breathe Contrast Singlet (5142)",
      slug: "dnc-5142",
      category: "Work Shirts",
      supplier_name: "DNC Workwear",
    }),
    row({
      name: "Kids Ribstop Athens Track Top (5517)",
      slug: "dnc-5517",
      category: "Work Shirts",
      supplier_name: "DNC Workwear",
    }),
    row({
      name: "Kids Cool-Breathe Side Panel Polo Shirt (5228)",
      slug: "dnc-5228",
      category: "Polos",
      supplier_name: "DNC Workwear",
    }),
    row({
      name: "Kids Cotton Tee (5102)",
      slug: "dnc-5102",
      category: "T-shirts",
      supplier_name: "DNC Workwear",
    }),
  ];

  it("routes DNC kids Work Shirts rows into Kid's/Shirts", () => {
    const shirts = filterProductsForSubCategoryBrowse("kids", "shirts", catalog);
    expect(NAMES(shirts)).toEqual(
      expect.arrayContaining([
        "Kids Cool-Breathe Contrast Singlet (5142)",
        "Kids Ribstop Athens Track Top (5517)",
      ]),
    );
  });

  it("keeps kids polos and tees out of Shirts", () => {
    const shirts = filterProductsForSubCategoryBrowse("kids", "shirts", catalog);
    expect(NAMES(shirts)).not.toContain("Kids Cool-Breathe Side Panel Polo Shirt (5228)");
    expect(NAMES(shirts)).not.toContain("Kids Cotton Tee (5102)");

    expect(NAMES(filterProductsForSubCategoryBrowse("kids", "polos", catalog))).toContain(
      "Kids Cool-Breathe Side Panel Polo Shirt (5228)",
    );
    expect(NAMES(filterProductsForSubCategoryBrowse("kids", "t-shirts", catalog))).toContain(
      "Kids Cotton Tee (5102)",
    );
  });
});

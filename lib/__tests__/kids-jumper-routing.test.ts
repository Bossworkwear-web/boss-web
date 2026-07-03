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

describe("kids browse jumper routing", () => {
  const catalog: CategoryBrowseProductRow[] = [
    row({ name: "JB's Wear JB's KIDS JUMPER (3KJ)", slug: "jb-3kj", category: "T-shirts", supplier_name: "JB's Wear" }),
    row({ name: "JB's Wear JB's KIDS FLEECY SWEAT (3KFS)", slug: "jb-3kfs", category: "T-shirts", supplier_name: "JB's Wear" }),
    // Biz Collection kids sweaters ship with empty `audience`; kid detection comes from the generated code map.
    row({ name: "Biz Collection SW310K", slug: "fb-bizcollection-sw310k", category: "Jackets", description: "Kids knit sweater", audience: null }),
    // Real tees must NOT leak into jumper even when description mentions fabric knit.
    row({ name: "JB's Wear JB's KIDS TEE (1KT)", slug: "jb-1kt", category: "T-shirts", supplier_name: "JB's Wear", description: "Ribbed knitted collar tee" }),
    row({ name: "Biz Collection T207KS", slug: "fb-bizcollection-t207ks", category: "T-shirts", description: "Soft knitted rib neck" }),
    // Real outerwear stays under jackets.
    row({ name: "JB's Wear JB's KIDS FLEECY HOODIE (3KFH)", slug: "jb-3kfh", category: "Jackets", supplier_name: "JB's Wear" }),
  ];

  it("routes named kids jumpers/sweats and Biz SW sweaters into Jumper", () => {
    const jumper = filterProductsForSubCategoryBrowse("kids", "jumper", catalog);
    expect(NAMES(jumper)).toEqual(
      expect.arrayContaining([
        "JB's Wear JB's KIDS JUMPER (3KJ)",
        "JB's Wear JB's KIDS FLEECY SWEAT (3KFS)",
        "Biz Collection SW310K",
      ]),
    );
  });

  it("keeps kids tees out of Jumper (description fabric words must not misroute)", () => {
    const jumper = filterProductsForSubCategoryBrowse("kids", "jumper", catalog);
    expect(NAMES(jumper)).not.toContain("JB's Wear JB's KIDS TEE (1KT)");
    expect(NAMES(jumper)).not.toContain("Biz Collection T207KS");

    const tshirts = filterProductsForSubCategoryBrowse("kids", "t-shirts", catalog);
    expect(NAMES(tshirts)).toEqual(
      expect.arrayContaining(["JB's Wear JB's KIDS TEE (1KT)", "Biz Collection T207KS"]),
    );
  });

  it("keeps kids fleecy hoodies under Jackets", () => {
    const jackets = filterProductsForSubCategoryBrowse("kids", "jackets", catalog);
    expect(NAMES(jackets)).toContain("JB's Wear JB's KIDS FLEECY HOODIE (3KFH)");
    const jumper = filterProductsForSubCategoryBrowse("kids", "jumper", catalog);
    expect(NAMES(jumper)).not.toContain("JB's Wear JB's KIDS FLEECY HOODIE (3KFH)");
  });
});

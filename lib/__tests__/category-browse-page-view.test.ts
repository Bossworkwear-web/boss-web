import { describe, expect, it } from "vitest";

import {
  buildMainCategoryBrowsePageView,
  buildSubCategoryBrowsePageView,
} from "@/lib/category-browse-page-view";
import type { CategoryBrowseProductRow } from "@/lib/main-category-browse";

function row(overrides: Partial<CategoryBrowseProductRow>): CategoryBrowseProductRow {
  return {
    id: overrides.id ?? overrides.slug ?? "id",
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

describe("category browse page view (client filter)", () => {
  const catalog: CategoryBrowseProductRow[] = [
    row({ id: "1", name: "JB's Wear JB's KIDS JUMPER (3KJ)", slug: "jb-3kj", category: "T-shirts", supplier_name: "JB's Wear" }),
    row({ id: "2", name: "JB's Wear JB's KIDS TEE (1KT)", slug: "jb-1kt", category: "T-shirts", supplier_name: "JB's Wear" }),
    row({ id: "3", name: "Biz Collection SW310K", slug: "fb-bizcollection-sw310k", category: "Jackets", audience: null }),
  ];

  it("filters kids/jumper client-side", () => {
    const view = buildSubCategoryBrowsePageView("kids", "jumper", catalog, {});
    expect(view.pageItems.map((r) => r.name)).toEqual(
      expect.arrayContaining(["JB's Wear JB's KIDS JUMPER (3KJ)", "Biz Collection SW310K"]),
    );
    expect(view.pageItems.map((r) => r.name)).not.toContain("JB's Wear JB's KIDS TEE (1KT)");
  });

  it("applies brand filter without emptying on stale brand param", () => {
    const view = buildSubCategoryBrowsePageView("kids", "jumper", catalog, { brandParam: "NoSuchBrand" });
    expect(view.brandParamEffective).toBe("");
    expect(view.pageItems.length).toBeGreaterThan(0);
  });

  it("builds main category view for mens without throwing", () => {
    const view = buildMainCategoryBrowsePageView("mens", catalog, {});
    expect(view.sortedCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(view.brandsForDropdown)).toBe(true);
  });
});

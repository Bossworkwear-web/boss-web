import { describe, expect, it } from "vitest";

import {
  BROWSE_DESCRIPTION_MAX_CHARS,
  slimBrowseCatalogRow,
} from "@/lib/storefront-catalog-fetch";
import type { CategoryBrowseProductRow } from "@/lib/main-category-browse";

function row(overrides: Partial<CategoryBrowseProductRow> = {}): CategoryBrowseProductRow {
  return {
    id: "id-1",
    name: "Test Product",
    base_price: 1000,
    sale_price: null,
    image_urls: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
    category: "Workwear",
    slug: "test-product",
    description: "Short",
    storefront_hidden: false,
    audience: null,
    supplier_name: "Supplier",
    available_colors: null,
    available_sizes: null,
    ...overrides,
  };
}

describe("slimBrowseCatalogRow", () => {
  it("keeps short rows unchanged", () => {
    const input = row({ image_urls: ["https://cdn.example/a.jpg"], description: "Short" });
    expect(slimBrowseCatalogRow(input)).toBe(input);
  });

  it("truncates long descriptions", () => {
    const long = "x".repeat(BROWSE_DESCRIPTION_MAX_CHARS + 40);
    const out = slimBrowseCatalogRow(row({ description: long }));
    expect(out.description).toHaveLength(BROWSE_DESCRIPTION_MAX_CHARS);
    expect(out.description).toBe(long.slice(0, BROWSE_DESCRIPTION_MAX_CHARS));
  });

  it("caps image_urls to one entry", () => {
    const out = slimBrowseCatalogRow(row());
    expect(out.image_urls).toEqual(["https://cdn.example/a.jpg"]);
  });

  it("prefers CL542UL browse hero when present in gallery", () => {
    const hero = "https://cdn.example/CL542UL_TALENT_MIDNIGHTNAVY_07.JPG";
    const out = slimBrowseCatalogRow(
      row({
        name: "Unisex Pulse Straight Leg Scrub Pant CL542UL",
        slug: "unisex-pulse-straight-leg-scrub-pant-cl542ul",
        image_urls: ["https://cdn.example/other.jpg", hero],
      }),
    );
    expect(out.image_urls).toEqual([hero]);
  });
});

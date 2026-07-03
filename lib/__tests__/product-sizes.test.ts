import { describe, expect, it } from "vitest";

import { normalizeProductSizeOptions, sortSizesForDisplay } from "@/lib/product-sizes";

describe("product-sizes", () => {
  it("places 2XS before XS in letter size order", () => {
    expect(sortSizesForDisplay(["XS", "M", "2XS", "L", "S"])).toEqual(["2XS", "XS", "S", "M", "L"]);
  });

  it("places 3XS and 2XS before XS", () => {
    expect(sortSizesForDisplay(["XS", "3XS", "2XS", "S"])).toEqual(["3XS", "2XS", "XS", "S"]);
  });

  it("normalizes JB 7SPP-style size runs for PDP", () => {
    const sizes = normalizeProductSizeOptions(
      ["L", "2XS", "XL", "M", "XS", "S", "3XL", "2XL"],
      "JB's Wear Polo (7SPP)",
      "jb-7spp",
      "Polos",
    );
    expect(sizes).toEqual(["2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL"]);
  });
});

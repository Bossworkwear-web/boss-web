import { describe, expect, it } from "vitest";

import {
  dncMensExclusiveFromWomensBrowseSubSlug,
  isDncMensExclusiveFromWomensListing,
} from "@/lib/dnc-glove-routing";
import { filterProductsForMainCategoryBrowse } from "@/lib/main-category-browse";
import { isProductVisibleInCategoryBrowse } from "@/lib/product-visibility";

const dnc5265 = {
  id: "1",
  name: "Adult Cool Breathe Athens Polo (5265)",
  slug: "dnc-5265",
  category: "Polos",
  supplier_name: "DNC Workwear",
  base_price: 20,
};

describe("DNC men's styles excluded from Women's browse", () => {
  it("flags listed men's DNC style codes", () => {
    expect(isDncMensExclusiveFromWomensListing(dnc5265.name, { slug: dnc5265.slug, supplier_name: dnc5265.supplier_name })).toBe(
      true,
    );
    expect(dncMensExclusiveFromWomensBrowseSubSlug(dnc5265.name, { slug: dnc5265.slug })).toBe("polos");
    expect(
      dncMensExclusiveFromWomensBrowseSubSlug("Adult Cotton Tee (5101)", { slug: "dnc-5101", supplier_name: "DNC Workwear" }),
    ).toBe("t-shirts");
  });

  it("lists under Men's/Polos and not Women's/Polos", () => {
    const mens = filterProductsForMainCategoryBrowse("mens", [dnc5265]);
    const womens = filterProductsForMainCategoryBrowse("womens", [dnc5265]);
    expect(mens.some((r) => r.slug === "dnc-5265")).toBe(true);
    expect(womens.some((r) => r.slug === "dnc-5265")).toBe(false);
    expect(isProductVisibleInCategoryBrowse("mens", "polos", dnc5265.name, { slug: dnc5265.slug, supplier_name: dnc5265.supplier_name })).toBe(
      true,
    );
    expect(
      isProductVisibleInCategoryBrowse("womens", "polos", dnc5265.name, { slug: dnc5265.slug, supplier_name: dnc5265.supplier_name }),
    ).toBe(false);
  });
});

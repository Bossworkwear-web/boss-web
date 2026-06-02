import { describe, expect, it } from "vitest";

import { productMatchesSearchQuery, scoreProductSearchMatch } from "@/lib/product-search";

describe("productMatchesSearchQuery — word queries", () => {
  it("matches vest in product title", () => {
    expect(
      productMatchesSearchQuery("Fix & Move™ Soft Shell Vest", "fix-move-vest", "Jackets", "vest", null),
    ).toBe(true);
  });

  it("does not match vest inside invest/harvest in description", () => {
    expect(
      productMatchesSearchQuery(
        "BRIGHTON LADY SHIRT LONG SLEEVE (2909L)",
        "brighton-2909l",
        "Shirts",
        "vest",
        "Great investment for your team. Harvest cotton blend.",
      ),
    ).toBe(false);
  });

  it("does not match vest as substring of sleeve in name", () => {
    expect(
      productMatchesSearchQuery("EPSOM MENS SHIRT LONG SLEEVE (1907L)", "epsom-1907l", "Shirts", "vest", null),
    ).toBe(false);
  });

  it("ranks title vest matches above description-only vest", () => {
    const titleScore = scoreProductSearchMatch("Hi Vis Safety Vest", "hv-vest", "PPE", "vest", null);
    const descScore = scoreProductSearchMatch(
      "Plain Cotton Tee",
      "plain-tee",
      "T-shirts",
      "vest",
      "Pair with our popular safety vest range.",
    );
    expect(titleScore).toBeGreaterThan(descScore);
  });
});

describe("productMatchesSearchQuery — style codes", () => {
  it("still matches compact style codes", () => {
    expect(
      productMatchesSearchQuery("Biz Collection ZH145 Polo", "bizcollection-zh145", "Polos", "ZH145", null),
    ).toBe(true);
  });
});

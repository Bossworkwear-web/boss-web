import { describe, expect, it } from "vitest";

import {
  levenshteinDistance,
  productMatchesSearchQuery,
  scoreProductSearchMatch,
} from "@/lib/product-search";

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

describe("productMatchesSearchQuery — colour / supplier / size extras", () => {
  it("matches colour labels such as Pacific Blue", () => {
    expect(
      productMatchesSearchQuery(
        "Endeavour Mens Polos",
        "ap-1310",
        "Polos",
        "pacific",
        null,
        null,
        { colors: ["Pacific Blue/white", "Navy/white"] },
      ),
    ).toBe(true);
  });

  it("matches supplier / brand name", () => {
    expect(
      productMatchesSearchQuery(
        "Endeavour Mens Polos",
        "ap-1310",
        "Polos",
        "aussie",
        null,
        null,
        { supplierName: "Aussie Pacific" },
      ),
    ).toBe(true);
  });

  it("matches size tokens", () => {
    expect(
      productMatchesSearchQuery("Endeavour Mens Polos", "ap-1310", "Polos", "2xl", null, null, {
        sizes: ["S", "M", "L", "XL", "2XL"],
      }),
    ).toBe(true);
  });
});

describe("productMatchesSearchQuery — typo tolerance", () => {
  it("matches single-edit typos on longer title words", () => {
    expect(
      productMatchesSearchQuery("Fix & Move Soft Shell Vest", "fix-move-vest", "Jackets", "veste", null),
    ).toBe(true);
    expect(
      productMatchesSearchQuery("Premium Work Polo", "premium-work-polo", "Polos", "pollo", null),
    ).toBe(true);
  });

  it("does not fuzzy-match very short tokens", () => {
    expect(
      productMatchesSearchQuery("Hi Vis Tee", "hi-vis-tee", "T-shirts", "hx", null),
    ).toBe(false);
  });
});

describe("levenshteinDistance", () => {
  it("counts edits", () => {
    expect(levenshteinDistance("polo", "pollo")).toBe(1);
    expect(levenshteinDistance("vest", "vest")).toBe(0);
  });
});

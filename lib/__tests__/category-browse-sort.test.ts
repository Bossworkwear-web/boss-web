import { describe, expect, it } from "vitest";

import { sortCategoryBrowseDefault } from "@/lib/category-browse-sort";

type Row = { name: string; slug?: string | null; category?: string | null };

describe("sortCategoryBrowseDefault — mens / womens JB polo priority", () => {
  const brandOf = () => "JB's Wear";

  it("orders 7PIP, 7PIPL, 7SPP before other JB polos, then other JB's Wear on mens", () => {
    const rows: Row[] = [
      { name: "JB's Wear Polo (7SPP)", slug: "jb-7spp", category: "Polos" },
      { name: "JB's Wear Other (6RKB)", slug: "jb-6rkb", category: "Shirts" },
      { name: "JB's Wear Long Sleeve (7PIPL)", slug: "jb-7pipl", category: "Polos" },
      { name: "JB's Wear Classic (7PIP)", slug: "jb-7pip", category: "Polos" },
    ];
    const sorted = sortCategoryBrowseDefault("mens", rows, brandOf);
    expect(sorted.map((r) => r.slug)).toEqual(["jb-7pip", "jb-7pipl", "jb-7spp", "jb-6rkb"]);
  });

  it("orders all JB polos before JB non-polo on mens", () => {
    const rows: Row[] = [
      { name: "JB's Wear Shirt (SH001)", slug: "jb-sh001", category: "Shirts" },
      { name: "JB's Wear Work Polo (7ABC)", slug: "jb-7abc", category: "Polos" },
      { name: "JB's Wear Classic (7PIP)", slug: "jb-7pip", category: "Polos" },
    ];
    const sorted = sortCategoryBrowseDefault("mens", rows, brandOf);
    expect(sorted.map((r) => r.slug)).toEqual(["jb-7pip", "jb-7abc", "jb-sh001"]);
  });

  it("orders JB polos first on womens (same rules as mens)", () => {
    const rows: Row[] = [
      { name: "JB's Wear Shirt (SH001)", slug: "jb-sh001", category: "Shirts" },
      { name: "JB's Wear Polo (7SPP)", slug: "jb-7spp", category: "Polos" },
      { name: "JB's Wear Classic (7PIP)", slug: "jb-7pip", category: "Polos" },
    ];
    const sorted = sortCategoryBrowseDefault("womens", rows, brandOf);
    expect(sorted.map((r) => r.slug)).toEqual(["jb-7pip", "jb-7spp", "jb-sh001"]);
  });

  it("does not pin JB polo leading order on workwear", () => {
    const rows: Row[] = [
      { name: "JB's Wear Polo (7SPP)", slug: "jb-7spp" },
      { name: "JB's Wear Classic (7PIP)", slug: "jb-7pip" },
    ];
    const sorted = sortCategoryBrowseDefault("workwear", rows, brandOf);
    expect(sorted[0].slug).toBe("jb-7pip");
    expect(sorted[1].slug).toBe("jb-7spp");
  });
});

describe("sortCategoryBrowseDefault — PPE Head Wear 4199", () => {
  const brandOf = () => "Headwear";

  it("pins style 4199 first on ppe / head-wear", () => {
    const rows: Row[] = [
      { name: "Classic Cap (3975)", slug: "hw-3975", category: "Head Wear" },
      { name: "Trucker Cap (4199)", slug: "hw-4199", category: "Head Wear" },
      { name: "Bucket Hat (4200)", slug: "hw-4200", category: "Head Wear" },
    ];
    const sorted = sortCategoryBrowseDefault("ppe", rows, brandOf, "head-wear");
    expect(sorted[0].slug).toBe("hw-4199");
  });

  it("does not pin 4199 on other PPE subcategories", () => {
    const rows: Row[] = [
      { name: "Classic Cap (3975)", slug: "hw-3975", category: "Head Wear" },
      { name: "Trucker Cap (4199)", slug: "hw-4199", category: "Head Wear" },
    ];
    const sorted = sortCategoryBrowseDefault("ppe", rows, brandOf, "miscellaneous");
    expect(sorted[0].slug).toBe("hw-3975");
  });
});

describe("sortCategoryBrowseDefault — workwear Blue Whale C91 / C81", () => {
  const brandOf = (item: Row) =>
    item.name.toLowerCase().includes("blue whale") ? "Blue Whale" : "JB's Wear";

  it("orders C91 then C81 before other brands on workwear", () => {
    const rows: Row[] = [
      { name: "Blue Whale Vest (C81)", slug: "blue-whale-c81" },
      { name: "JB's Wear Polo (7PIP)", slug: "jb-7pip", category: "Polos" },
      { name: "Blue Whale Shirt (C91)", slug: "blue-whale-c91" },
    ];
    const sorted = sortCategoryBrowseDefault("workwear", rows, brandOf);
    expect(sorted.map((r) => r.slug)).toEqual(["blue-whale-c91", "blue-whale-c81", "jb-7pip"]);
  });
});

describe("sortCategoryBrowseDefault — Chef Jackets snap-button family", () => {
  const brandOf = () => "JB's Wear";

  it("keeps 5CJL, 5CJL1, 5CJS, 5CJS1 adjacent in that order on chef/jackets", () => {
    const rows: Row[] = [
      { name: "JB's Wear JB's S/S SNAP BUTTON CHEFS JACKET (5CJS)", slug: "jb-5cjs" },
      { name: "JB's Wear Other Jacket (5CJX)", slug: "jb-5cjx" },
      { name: "JB's Wear JB's LADIES S/S SNAP BUTTON CHEFS JACKET (5CJS1)", slug: "jb-5cjs1" },
      { name: "JB's Wear Alpha Coat (AAA)", slug: "jb-aaa" },
      { name: "JB's Wear JB's LADIES L/S SNAP BUTTON CHEFS JACKET (5CJL1)", slug: "jb-5cjl1" },
      { name: "JB's Wear JB's L/S SNAP BUTTON CHEFS JACKET (5CJL)", slug: "jb-5cjl" },
      { name: "JB's Wear Zebra Jacket (ZZZ)", slug: "jb-zzz" },
    ];
    const sorted = sortCategoryBrowseDefault("chef", rows, brandOf, "jackets");
    const familyIdx = sorted.findIndex((r) => r.slug === "jb-5cjl");
    expect(sorted.slice(familyIdx, familyIdx + 4).map((r) => r.slug)).toEqual([
      "jb-5cjl",
      "jb-5cjl1",
      "jb-5cjs",
      "jb-5cjs1",
    ]);
  });

  it("keeps 5CJ, 5CJ1, 5CJ2, 5CJ21 adjacent in that order on chef/jackets", () => {
    const rows: Row[] = [
      { name: "JB's Wear JB's S/S CHEFS JACKET (5CJ2)", slug: "jb-5cj2" },
      { name: "JB's Wear Other Jacket (AAA)", slug: "jb-aaa" },
      { name: "JB's Wear JB's LADIES S/S CHEF'S JACKET (5CJ21)", slug: "jb-5cj21" },
      { name: "JB's Wear JB's LADIES L/S CHEF'S JACKET (5CJ1)", slug: "jb-5cj1" },
      { name: "JB's Wear JB's L/S CHEFS JACKET (5CJ)", slug: "jb-5cj" },
      { name: "JB's Wear Zebra Jacket (ZZZ)", slug: "jb-zzz" },
    ];
    const sorted = sortCategoryBrowseDefault("chef", rows, brandOf, "jackets");
    const familyIdx = sorted.findIndex((r) => r.slug === "jb-5cj");
    expect(sorted.slice(familyIdx, familyIdx + 4).map((r) => r.slug)).toEqual([
      "jb-5cj",
      "jb-5cj1",
      "jb-5cj2",
      "jb-5cj21",
    ]);
  });

  it("keeps 5MP and 5LP adjacent on chef/Tops (jackets slug)", () => {
    const rows: Row[] = [
      { name: "JB's Wear JB's LADIES CHEF POLO (5LP)", slug: "jb-5lp" },
      { name: "JB's Wear Other Top (AAA)", slug: "jb-aaa" },
      { name: "JB's Wear JB's CHEF POLO (5MP)", slug: "jb-5mp" },
      { name: "JB's Wear Zebra Top (ZZZ)", slug: "jb-zzz" },
    ];
    const sorted = sortCategoryBrowseDefault("chef", rows, brandOf, "jackets");
    const familyIdx = sorted.findIndex((r) => r.slug === "jb-5mp");
    expect(sorted.slice(familyIdx, familyIdx + 2).map((r) => r.slug)).toEqual(["jb-5mp", "jb-5lp"]);
  });

  it("does not cluster the family on other chef subcategories", () => {
    const rows: Row[] = [
      { name: "JB's Wear JB's S/S SNAP BUTTON CHEFS JACKET (5CJS)", slug: "jb-5cjs" },
      { name: "JB's Wear JB's L/S SNAP BUTTON CHEFS JACKET (5CJL)", slug: "jb-5cjl" },
      { name: "JB's Wear JB's LADIES S/S SNAP BUTTON CHEFS JACKET (5CJS1)", slug: "jb-5cjs1" },
      { name: "JB's Wear JB's LADIES L/S SNAP BUTTON CHEFS JACKET (5CJL1)", slug: "jb-5cjl1" },
    ];
    // Pure A–Z by name (LADIES S/S before mens S/S) — not the jackets family order.
    const sorted = sortCategoryBrowseDefault("chef", rows, brandOf, "pants");
    expect(sorted.map((r) => r.slug)).toEqual(["jb-5cjl", "jb-5cjl1", "jb-5cjs1", "jb-5cjs"]);
  });
});

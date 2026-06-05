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

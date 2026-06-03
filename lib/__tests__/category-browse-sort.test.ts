import { describe, expect, it } from "vitest";

import { sortCategoryBrowseDefault } from "@/lib/category-browse-sort";

type Row = { name: string; slug?: string | null };

describe("sortCategoryBrowseDefault — mens JB leading styles", () => {
  const brandOf = () => "JB's Wear";

  it("orders 7PIP, 7PIPL, 7SPP before other JB's Wear on mens", () => {
    const rows: Row[] = [
      { name: "JB's Wear Polo (7SPP)", slug: "jb-7spp" },
      { name: "JB's Wear Other (6RKB)", slug: "jb-6rkb" },
      { name: "JB's Wear Long Sleeve (7PIPL)", slug: "jb-7pipl" },
      { name: "JB's Wear Classic (7PIP)", slug: "jb-7pip" },
    ];
    const sorted = sortCategoryBrowseDefault("mens", rows, brandOf);
    expect(sorted.map((r) => r.slug)).toEqual(["jb-7pip", "jb-7pipl", "jb-7spp", "jb-6rkb"]);
  });

  it("does not pin leading styles on workwear", () => {
    const rows: Row[] = [
      { name: "JB's Wear Polo (7SPP)", slug: "jb-7spp" },
      { name: "JB's Wear Classic (7PIP)", slug: "jb-7pip" },
    ];
    const sorted = sortCategoryBrowseDefault("workwear", rows, brandOf);
    expect(sorted[0].slug).toBe("jb-7pip");
    expect(sorted[1].slug).toBe("jb-7spp");
  });
});

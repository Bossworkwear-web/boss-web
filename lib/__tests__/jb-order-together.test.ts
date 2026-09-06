import { describe, expect, it } from "vitest";

import {
  jbOrderTogetherSpecForProduct,
  jbStorefrontSlugForStyleCode,
  jbStyleCodeFromNameOrSlug,
} from "@/lib/jb-order-together";

describe("jbStyleCodeFromNameOrSlug", () => {
  it("reads style from jb- slug", () => {
    expect(jbStyleCodeFromNameOrSlug("x", "jb-5acbc")).toBe("5ACBC");
    expect(jbStyleCodeFromNameOrSlug("x", "chef-jb-5acbs")).toBe("5ACBS");
  });

  it("reads trailing (CODE) from name", () => {
    expect(
      jbStyleCodeFromNameOrSlug("JB's Wear JB's CROSS BACK CANVAS APRON (WITHOUT STRAP) (5ACBC)"),
    ).toBe("5ACBC");
  });
});

describe("jbOrderTogetherSpecForProduct", () => {
  it("maps WITHOUT STRAP apron bodies to 5ACBS and 5ACPS", () => {
    for (const code of ["5ACB", "5ACBB", "5ACBC", "5ACBD", "5ACBE"]) {
      const spec = jbOrderTogetherSpecForProduct({ slug: `jb-${code.toLowerCase()}` });
      expect(spec?.companions.map((c) => c.styleCode)).toEqual(["5ACBS", "5ACPS"]);
      expect(spec?.note).toMatch(/without straps/i);
    }
  });

  it("does not map strap or PU-strap apron", () => {
    expect(jbOrderTogetherSpecForProduct({ slug: "jb-5acbs" })).toBeNull();
    expect(jbOrderTogetherSpecForProduct({ slug: "jb-5acbp" })).toBeNull();
    expect(jbOrderTogetherSpecForProduct({ slug: "jb-5acby" })).toBeNull();
    expect(jbOrderTogetherSpecForProduct({ slug: "jb-5acps" })).toBeNull();
  });
});

describe("jbStorefrontSlugForStyleCode", () => {
  it("builds jb- slug", () => {
    expect(jbStorefrontSlugForStyleCode("5ACBY")).toBe("jb-5acby");
  });
});

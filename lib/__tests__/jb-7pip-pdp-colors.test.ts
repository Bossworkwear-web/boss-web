import { describe, expect, it } from "vitest";

import {
  applyJb7pipBlackRedFirstPdp,
  jb7pipCategoryBrowseHeroUrl,
  matchesJb7pipBlackRedColor,
} from "@/lib/jb-7pip-pdp-colors";

describe("applyJb7pipBlackRedFirstPdp", () => {
  it("moves Black/Red to first colour on 7PIP", () => {
    const colors = ["Navy/White", "Black/Red", "Black/White"] as const;
    const out = applyJb7pipBlackRedFirstPdp("7PIP", colors, ["a#jbpc=3", "b", "c"], 3);
    expect(out.colors[0]).toBe("Black/Red");
    expect(out.imageUrls[0]).toMatch(/^b#jbpc=3$/);
    expect(out.imageUrls[1]).toBe("a");
  });

  it("ignores 7PIPL", () => {
    const colors = ["Navy/White", "Black/Red"] as const;
    const out = applyJb7pipBlackRedFirstPdp("7PIPL", colors, ["a", "b"], 2);
    expect(out.colors[0]).toBe("Navy/White");
  });

  it("matches Black / Red spacing", () => {
    expect(matchesJb7pipBlackRedColor("Black / Red")).toBe(true);
  });

  it("picks Black/Red hero for category browse card", () => {
    const hero = jb7pipCategoryBrowseHeroUrl(
      "7PIP",
      ["navy#jbpc=2", "black-red-hero.jpg"],
      ["Navy/White", "Black/Red"],
    );
    expect(hero).toBe("black-red-hero.jpg");
  });
});

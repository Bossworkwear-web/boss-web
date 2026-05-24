import { describe, expect, it } from "vitest";

import {
  DEFAULT_HOMEPAGE_HERO,
  LEGAL_PAGE_LABELS,
  LEGAL_PAGE_PATHS,
  LEGAL_PAGE_SLUGS,
  legalPageContentKey,
  mergeHomepageHeroContent,
} from "@/lib/site-content";

describe("legalPageContentKey", () => {
  it("prefixes slug with legal:", () => {
    expect(legalPageContentKey("terms")).toBe("legal:terms");
    expect(legalPageContentKey("privacy")).toBe("legal:privacy");
  });
});

describe("mergeHomepageHeroContent", () => {
  it("returns defaults when input is empty", () => {
    expect(mergeHomepageHeroContent({})).toEqual(DEFAULT_HOMEPAGE_HERO);
  });

  it("trims and merges partial overrides", () => {
    expect(
      mergeHomepageHeroContent({
        line1: "  Custom headline  ",
        line2: "",
        subtext: "New subtext",
      }),
    ).toEqual({
      line1: "Custom headline",
      line2: DEFAULT_HOMEPAGE_HERO.line2,
      subtext: "New subtext",
    });
  });

  it("falls back to defaults for whitespace-only values", () => {
    expect(
      mergeHomepageHeroContent({
        line1: "   ",
        line2: "\n",
        subtext: "\t",
      }),
    ).toEqual(DEFAULT_HOMEPAGE_HERO);
  });
});

describe("legal page metadata", () => {
  it("defines labels and paths for every slug", () => {
    for (const slug of LEGAL_PAGE_SLUGS) {
      expect(LEGAL_PAGE_LABELS[slug]).toMatch(/\S/);
      expect(LEGAL_PAGE_PATHS[slug]).toMatch(/^\//);
    }
  });
});

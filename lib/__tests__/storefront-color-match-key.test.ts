import { describe, expect, it } from "vitest";

import {
  colorMatchKey,
  colorMatchKeysCompatible,
} from "@/lib/storefront-color-match-key";

describe("storefront color match — Blue Whale C91 hi-vis combos", () => {
  it("maps Yellow/Navy chip to yellownavy (keeps navy)", () => {
    expect(colorMatchKey("Safety Yellow/Navy blue")).toBe("yellownavy");
    expect(colorMatchKey("FYN")).toBe("yellownavy");
    expect(colorMatchKey("C91 FYN")).toBe("yellownavy");
    expect(colorMatchKey("Yellow / Navy")).toBe("yellownavy");
    expect(colorMatchKey("yellow navy")).toBe("yellownavy");
  });

  it("maps Orange/Navy chip to orangenavy (not bare orange)", () => {
    expect(colorMatchKey("Safety Orange/navy blue")).toBe("orangenavy");
    expect(colorMatchKey("Orange / Navy")).toBe("orangenavy");
    expect(colorMatchKey("C91 ORANGE NAVY")).toBe("orangenavy");
    expect(colorMatchKey("FON")).toBe("orangenavy");
    // Filename-derived vent shot is bare orange; chip stays orangenavy (exact ≠).
    expect(colorMatchKey("Orange")).toBe("orange");
    expect(colorMatchKey("Safety Orange/navy blue")).not.toBe(colorMatchKey("Orange"));
  });

  it("treats yellow↔yellownavy and orange↔orangenavy as compatible", () => {
    expect(
      colorMatchKeysCompatible(
        colorMatchKey("Safety Yellow/Navy blue"),
        colorMatchKey("yellow"),
      ),
    ).toBe(true);
    expect(
      colorMatchKeysCompatible(
        colorMatchKey("Safety Orange/navy blue"),
        colorMatchKey("orange"),
      ),
    ).toBe(true);
    expect(
      colorMatchKeysCompatible(
        colorMatchKey("Safety Yellow/Navy blue"),
        colorMatchKey("Safety Orange/navy blue"),
      ),
    ).toBe(false);
  });
});

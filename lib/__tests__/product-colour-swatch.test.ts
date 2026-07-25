import { describe, expect, it } from "vitest";

import { productColourPartToHex, productColourLabelToSwatches } from "@/lib/product-colour-swatch";

describe("product colour swatches — Gunmetal", () => {
  it("maps Gunmetal to a dark blue-grey, not the purple hash fallback", () => {
    expect(productColourPartToHex("Gunmetal").toLowerCase()).toBe("#53565a");
    expect(productColourPartToHex("gun metal").toLowerCase()).toBe("#53565a");
    expect(productColourLabelToSwatches("Gunmetal")[0]?.hex.toLowerCase()).toBe("#53565a");
  });
});

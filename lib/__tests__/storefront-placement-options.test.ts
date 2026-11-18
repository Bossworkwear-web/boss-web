import { describe, expect, it } from "vitest";

import { isEmbroideryOfferedForPlacement } from "@/lib/storefront-placement-options";

describe("isEmbroideryOfferedForPlacement", () => {
  it("keeps embroidery on chest, sleeve, and back upper", () => {
    for (const code of ["LC", "RC", "LS", "RS", "BU"]) {
      expect(isEmbroideryOfferedForPlacement(code)).toBe(true);
    }
  });

  it("drops embroidery on CC and BM, and on the existing print-only spots", () => {
    for (const code of ["CC", "BM", "FB", "FC"]) {
      expect(isEmbroideryOfferedForPlacement(code)).toBe(false);
    }
  });
});

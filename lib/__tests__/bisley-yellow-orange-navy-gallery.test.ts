import { describe, expect, it } from "vitest";

import {
  alignBisleyYellowOrangeGalleryToColorChips,
  bisleyYellowOrangeKindFromImageUrl,
  detectBisleyYellowOrangeChipImageMismatch,
} from "@/lib/bisley-yellow-orange-navy-gallery";

describe("bisley yellow/orange navy gallery alignment", () => {
  it("maps TT04/TT05 and TT01/TT02 to yellow/orange", () => {
    expect(bisleyYellowOrangeKindFromImageUrl("LR_BK6619T_TT04_1.jpg")).toBe("yellow");
    expect(bisleyYellowOrangeKindFromImageUrl("LR_BK6619T_TT05_1.jpg")).toBe("orange");
    expect(bisleyYellowOrangeKindFromImageUrl("x_TT01_1.jpg")).toBe("yellow");
    expect(bisleyYellowOrangeKindFromImageUrl("x_TT02_1.jpg")).toBe("orange");
  });

  it("fixes BK6619T-style Orange-first chips vs Yellow-first TT04/TT05 images", () => {
    const colors = ["Orange/Navy", "Yellow/Navy"];
    const images = [
      "https://cdn.example/LR_BK6619T_TT04_1.jpg",
      "https://cdn.example/LR_BK6619T_TT05_1.jpg",
    ];
    expect(detectBisleyYellowOrangeChipImageMismatch(colors, images)?.mismatched).toBe(true);
    const aligned = alignBisleyYellowOrangeGalleryToColorChips(colors, images);
    expect(aligned[0]).toContain("TT05");
    expect(aligned[1]).toContain("TT04");
    expect(detectBisleyYellowOrangeChipImageMismatch(colors, aligned)?.mismatched).toBe(false);
  });

  it("classifies BF61/BF51, BVEO/BBLY, and _Yellow/_Orange filenames", () => {
    expect(bisleyYellowOrangeKindFromImageUrl("BJ6770T_BF61-0.jpg")).toBe("orange");
    expect(bisleyYellowOrangeKindFromImageUrl("BJ6770T_BF51-0.jpg")).toBe("yellow");
    expect(bisleyYellowOrangeKindFromImageUrl("BK1017T_BVEO_01.jpg")).toBe("orange");
    expect(bisleyYellowOrangeKindFromImageUrl("BK1017T_BBLY_02.jpg")).toBe("yellow");
    expect(bisleyYellowOrangeKindFromImageUrl("BJ6979T_1_Yellow.jpg")).toBe("yellow");
    expect(bisleyYellowOrangeKindFromImageUrl("BJ6979T_1_Orange.jpg")).toBe("orange");
    expect(bisleyYellowOrangeKindFromImageUrl("BPC6150T_NVOR_01.JPG")).toBe("orange");
    expect(bisleyYellowOrangeKindFromImageUrl("BPC6150T_NVYL_01.JPG")).toBe("yellow");
  });
});

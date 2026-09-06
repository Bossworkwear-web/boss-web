import { describe, expect, it } from "vitest";

import {
  buildApronStorefrontPlacementOptions,
  isApronPdpPlacementProduct,
  resolveApronPdpPlacementProfile,
  resolveApronPdpStyleCode,
} from "@/lib/apron-storefront-placements";
import { placementLogoLocationSrc } from "@/lib/placement-logo-location";

describe("apron storefront placements", () => {
  it("matches AL/AM apron style codes", () => {
    expect(resolveApronPdpStyleCode({ slug: "dnc-2501", name: "Cotton Drill Apron (2501)" })).toBe("2501");
    expect(resolveApronPdpPlacementProfile({ slug: "jb-5bsnp", name: "Bib Apron (5BSNP)" })).toBe("al-am");
    expect(resolveApronPdpPlacementProfile({ slug: "ba35", name: "Barley Apron (BA35)" })).toBe("al-am");
  });

  it("matches SAM/SAB apron style codes", () => {
    expect(resolveApronPdpPlacementProfile({ slug: "dnc-2301", name: "Apron (2301)" })).toBe("sam-sab");
    expect(resolveApronPdpPlacementProfile({ slug: "jb-5a", name: "Apron (5A)" })).toBe("sam-sab");
    expect(resolveApronPdpPlacementProfile({ slug: "ba94", name: "Apron (BA94)" })).toBe("sam-sab");
  });

  it("does not match unrelated products", () => {
    expect(isApronPdpPlacementProduct({ slug: "jb-7pip", name: "Polo (7PIP)" })).toBe(false);
  });

  it("exposes AL and AM with requested pricing", () => {
    const options = buildApronStorefrontPlacementOptions("al-am");
    expect(options.map((o) => o.diagramAbbr)).toEqual(["AL", "AM"]);
    expect(options[0]).toMatchObject({ embroideryCost: 9.95, printingCost: 9.95 });
    expect(options[1]).toMatchObject({ embroideryCost: 24.95, printingCost: 19.95 });
  });

  it("exposes SAM and SAB with requested pricing", () => {
    const options = buildApronStorefrontPlacementOptions("sam-sab");
    expect(options.map((o) => o.diagramAbbr)).toEqual(["SAM", "SAB"]);
    expect(options[0]).toMatchObject({ embroideryCost: 9.95, printingCost: 9.95 });
    expect(options[1]).toMatchObject({ embroideryCost: 24.95, printingCost: 19.95 });
  });

  it("maps apron placements to Logo_Location diagrams", () => {
    expect(placementLogoLocationSrc("apron-al", "Apron Left", { diagramAbbr: "AL" })).toBe(
      "/Logo_Location/AL.png",
    );
    expect(placementLogoLocationSrc("apron-sam", "Side Apron Middle", { diagramAbbr: "SAM" })).toBe(
      "/Logo_Location/SAM.png",
    );
    expect(placementLogoLocationSrc("apron-sab", "Side Apron Bottom", { diagramAbbr: "SAB" })).toBe(
      "/Logo_Location/SAB.png",
    );
  });
});

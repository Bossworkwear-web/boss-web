import type { StorefrontPlacementOption } from "@/lib/storefront-placement-options";

/** Headwear PDP §4 — logo on cap front / back (`public/Logo_Location/HF.png`, `HB.png`). */
export const HEADWEAR_PDP_PLACEMENT_ROWS: readonly { id: string; name: string }[] = [
  { id: "head-front", name: "Head Front" },
  { id: "head-back", name: "Head Back" },
];

export function buildHeadwearStorefrontPlacementOptions(): StorefrontPlacementOption[] {
  return [
    {
      id: "head-front",
      label: "Head Front",
      short: "HF",
      diagramAbbr: "HF",
      embroideryCost: 9.95,
      printingCost: 9.95,
    },
    {
      id: "head-back",
      label: "Head Back",
      short: "HB",
      diagramAbbr: "HB",
      embroideryCost: 7.95,
      printingCost: 0,
    },
  ];
}

/** Printing on head back (HB) is not offered — embroidery only. */
export function isPrintingOfferedForHeadwearPlacement(diagramAbbr: string): boolean {
  return diagramAbbr.trim().toUpperCase() === "HF";
}

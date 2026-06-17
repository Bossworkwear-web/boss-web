import { describe, expect, it } from "vitest";
import {
  storefrontCartNetProductSubtotalAfterVolumeAud,
  storefrontVolumeAdjustedCartLines,
} from "@/lib/storefront-volume-discount";

describe("storefrontVolumeAdjustedCartLines", () => {
  it("keeps priced lines on the correct cart id (regular then headwear interleaved)", () => {
    const c91Orange = {
      id: "line-c91-orange",
      unitPrice: 50,
      listUnitPrice: 50,
      quantity: 100,
      supplierName: "Blue Whale",
      productPathSlug: "bw-c91",
    };
    const hat = {
      id: "line-hat-4050",
      unitPrice: 30,
      listUnitPrice: 30,
      quantity: 50,
      supplierName: "Headwear",
      productPathSlug: "hw-4050",
      productId: "hat-4050",
    };
    const c91Yellow = {
      id: "line-c91-yellow",
      unitPrice: 50,
      listUnitPrice: 50,
      quantity: 50,
      supplierName: "Blue Whale",
      productPathSlug: "bw-c91",
    };
    const items = [c91Orange, hat, c91Yellow];

    const adjusted = storefrontVolumeAdjustedCartLines(items);
    const byId = Object.fromEntries(adjusted.map((r) => [r.id, r]));

    expect(byId["line-hat-4050"]!.unitPrice).toBeLessThan(byId["line-c91-orange"]!.unitPrice);
    expect(byId["line-c91-yellow"]!.unitPrice).toBeCloseTo(byId["line-c91-orange"]!.unitPrice, 1);
    expect(byId["line-hat-4050"]!.unitPrice).not.toBeCloseTo(byId["line-c91-yellow"]!.unitPrice, 0);

    const { net } = storefrontCartNetProductSubtotalAfterVolumeAud(items);
    const sum = adjusted.reduce((s, row) => s + row.totalPrice, 0);
    expect(sum).toBe(net);
  });
});

import { describe, expect, it } from "vitest";
import {
  storefrontCartNetProductSubtotalAfterVolumeAud,
  storefrontVolumeAdjustedCartLines,
} from "@/lib/storefront-volume-discount";

describe("storefrontVolumeAdjustedCartLines", () => {
  it("keeps priced lines in the same order as cart items (regular then headwear interleaved)", () => {
    const c91Orange = {
      unitPrice: 50,
      listUnitPrice: 50,
      quantity: 100,
      supplierName: "Blue Whale",
      productPathSlug: "bw-c91",
    };
    const hat = {
      unitPrice: 30,
      listUnitPrice: 30,
      quantity: 50,
      supplierName: "Headwear",
      productPathSlug: "hw-4050",
      productId: "hat-4050",
    };
    const c91Yellow = {
      unitPrice: 50,
      listUnitPrice: 50,
      quantity: 50,
      supplierName: "Blue Whale",
      productPathSlug: "bw-c91",
    };
    const items = [c91Orange, hat, c91Yellow];

    const adjusted = storefrontVolumeAdjustedCartLines(items);
    expect(adjusted.length).toBe(3);

    // Hat (headwear) should keep headwear list unit — not inherit a C91 apparel line price.
    expect(adjusted[1]!.unitPrice).toBeLessThan(adjusted[0]!.unitPrice);
    expect(adjusted[1]!.totalPrice).toBeLessThan(adjusted[2]!.totalPrice);

    const { net } = storefrontCartNetProductSubtotalAfterVolumeAud(items);
    const sum = adjusted.reduce((s, row) => s + row.totalPrice, 0);
    expect(sum).toBe(net);
  });
});

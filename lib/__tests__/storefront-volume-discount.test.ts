import { describe, expect, it } from "vitest";
import {
  sortStorefrontCartLinesHeadwearLast,
  storefrontCartNetProductSubtotalAfterVolumeAud,
  storefrontVolumeAdjustedCartLines,
  volumeAdjustedCartLinePricesById,
} from "@/lib/storefront-volume-discount";

function expectLinePricesMatchQuantity(
  line: { id?: string; quantity: number; unitPrice: number; totalPrice: number },
) {
  const implied = Math.round(line.unitPrice * line.quantity * 100) / 100;
  expect(Math.abs(implied - line.totalPrice)).toBeLessThanOrEqual(0.02);
}

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

  it("preserves input order and id alignment when headwear sits between apparel lines", () => {
    const items = [
      {
        id: "shirt-s",
        productId: "c91",
        unitPrice: 48.7,
        listUnitPrice: 48.7,
        quantity: 50,
        supplierName: "DNC",
        productPathSlug: "dnc-c91",
      },
      {
        id: "shirt-m",
        productId: "c91",
        unitPrice: 48.7,
        listUnitPrice: 48.7,
        quantity: 50,
        supplierName: "DNC",
        productPathSlug: "dnc-c91",
      },
      {
        id: "hat-black",
        productId: "hat-4199",
        unitPrice: 45,
        listUnitPrice: 45,
        quantity: 100,
        supplierName: "Headwear",
        productPathSlug: "hw-4199",
      },
      {
        id: "shirt-l",
        productId: "c81",
        unitPrice: 48.7,
        listUnitPrice: 48.7,
        quantity: 50,
        supplierName: "DNC",
        productPathSlug: "dnc-c81",
      },
    ];

    const adjusted = storefrontVolumeAdjustedCartLines(items);
    expect(adjusted.map((row) => row.id)).toEqual(items.map((row) => row.id));

    const byId = volumeAdjustedCartLinePricesById(items);
    for (const item of items) {
      const priced = byId.get(item.id)!;
      expect(priced.totalPrice).toBe(adjusted.find((row) => row.id === item.id)!.totalPrice);
      expectLinePricesMatchQuantity({
        id: item.id,
        quantity: item.quantity,
        unitPrice: priced.unitPrice,
        totalPrice: priced.totalPrice,
      });
    }

    expect(byId.get("hat-black")!.unitPrice).toBeLessThan(byId.get("shirt-l")!.unitPrice);
    expect(byId.get("shirt-s")!.unitPrice).toBeCloseTo(byId.get("shirt-l")!.unitPrice, 1);
  });
});

describe("sortStorefrontCartLinesHeadwearLast", () => {
  it("moves headwear lines after apparel while keeping relative order within each group", () => {
    const items = [
      { id: "a", supplierName: "DNC", productPathSlug: "dnc-c91" },
      { id: "b", supplierName: "DNC", productPathSlug: "dnc-c91" },
      { id: "hat", supplierName: "Headwear", productPathSlug: "hw-4199" },
      { id: "c", supplierName: "DNC", productPathSlug: "dnc-c81" },
      { id: "cap", category: "Head wear", productPathSlug: "brushed-cap" },
    ];
    expect(sortStorefrontCartLinesHeadwearLast(items).map((row) => row.id)).toEqual([
      "a",
      "b",
      "c",
      "hat",
      "cap",
    ]);
  });
});

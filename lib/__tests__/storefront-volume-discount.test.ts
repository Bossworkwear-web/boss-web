import { describe, expect, it } from "vitest";
import {
  inferHeadwearCartLineFields,
  isHeadwearVolumeDiscountCartLine,
  sortStorefrontCartLinesHeadwearLast,
  storefrontCartNetProductSubtotalAfterVolumeAud,
  storefrontVolumeAdjustedCartLines,
  volumeAdjustedCartLinePricesById,
} from "@/lib/storefront-volume-discount";

function expectLinePricesMatchQuantity(
  line: { id?: string; quantity: number; unitPrice: number; totalPrice: number },
) {
  const implied = Math.round(line.unitPrice * line.quantity * 100) / 100;
  // Unit is rounded from total/qty; allow a few cents of display drift on large qty lines.
  expect(Math.abs(implied - line.totalPrice)).toBeLessThanOrEqual(0.15);
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

    const { net, volumeDiscountAud, regularVolumeDiscountAud, headwearVolumeDiscountAud } =
      storefrontCartNetProductSubtotalAfterVolumeAud(items);
    const sum = adjusted.reduce((s, row) => s + row.totalPrice, 0);
    expect(sum).toBe(net);
    expect(volumeDiscountAud).toBeCloseTo(regularVolumeDiscountAud + headwearVolumeDiscountAud, 2);
    expect(headwearVolumeDiscountAud).toBeGreaterThan(0);
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

  it("detects Headwear only via supplier/slug/category — not shared numeric model codes", () => {
    const capNamedOnly = {
      id: "cap-2653-name",
      productName: "100% Recycled Earth Friendly Fabric (2653)",
      unitPrice: 30,
      listUnitPrice: 30,
      quantity: 50,
    };
    // Name-only numeric codes are ambiguous across suppliers.
    expect(isHeadwearVolumeDiscountCartLine(capNamedOnly)).toBe(false);
    expect(inferHeadwearCartLineFields(capNamedOnly)).toEqual({});

    const capHeadwear = {
      id: "cap-2653",
      productName: "100% Recycled Earth Friendly Fabric (2653)",
      productId: "hw-2653",
      productPathSlug: "hw-2653",
      supplierName: "Headwear",
      unitPrice: 30,
      listUnitPrice: 30,
      quantity: 50,
    };
    expect(isHeadwearVolumeDiscountCartLine(capHeadwear)).toBe(true);
    expect(inferHeadwearCartLineFields(capHeadwear)).toEqual({});
  });

  it("does not treat Aussie Pacific numeric style codes as Headwear volume lines", () => {
    const polo = {
      id: "ap-1311",
      productName: "TASMAN MENS POLOS (1311)",
      productPathSlug: "ap-1311",
      supplierName: "Aussie Pacific",
      category: "Polos",
      unitPrice: 46.05,
      listUnitPrice: 46.05,
      quantity: 50,
    };
    expect(isHeadwearVolumeDiscountCartLine(polo)).toBe(false);
    expect(inferHeadwearCartLineFields(polo)).toEqual({});

    const adjusted = storefrontVolumeAdjustedCartLines([polo]);
    // Apparel volume (~10% at ~$2302 subtotal), not Headwear 48% at qty 50.
    expect(adjusted[0]!.totalPrice).toBeCloseTo(46.05 * 50 * 0.9, 1);
    expect(adjusted[0]!.totalPrice).toBeGreaterThan(1900);
    expect(adjusted[0]!.totalPrice).not.toBeCloseTo(1197.3, 0);
  });

  it("does not merge Headwear volume qty across different suppliers with the same model code", () => {
    const apLikeName = {
      id: "ap-line",
      productName: "Tasman Polo (1311)",
      productPathSlug: "ap-1311",
      supplierName: "Aussie Pacific",
      productId: "ap-uuid",
      unitPrice: 40,
      listUnitPrice: 40,
      quantity: 50,
    };
    const hw = {
      id: "hw-line",
      productName: "Some Cap (1311)",
      productPathSlug: "hw-1311",
      supplierName: "Headwear",
      productId: "hw-uuid",
      unitPrice: 30,
      listUnitPrice: 30,
      quantity: 50,
    };
    expect(isHeadwearVolumeDiscountCartLine(apLikeName)).toBe(false);
    expect(isHeadwearVolumeDiscountCartLine(hw)).toBe(true);

    const adjusted = storefrontVolumeAdjustedCartLines([apLikeName, hw]);
    const byId = Object.fromEntries(adjusted.map((r) => [r.id, r]));
    // AP stays on apparel tiers; Headwear uses its own qty-50 tier (48%), not combined with AP.
    expect(byId["ap-line"]!.totalPrice).toBeCloseTo(40 * 50 * 0.9, 1);
    expect(byId["hw-line"]!.totalPrice).toBeCloseTo(30 * 50 * (1 - 0.48), 1);
  });
});

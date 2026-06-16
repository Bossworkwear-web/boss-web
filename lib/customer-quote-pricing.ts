import { getDiscountPercent } from "@/lib/discounts";
import { storefrontCardDisplayPrices, storefrontRetailFromSupplierBase, storefrontRetailProductMetaFromRow } from "@/lib/product-price";
import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";
import { storefrontVolumeAdjustedCartLines } from "@/lib/storefront-volume-discount";

/**
 * Quote line snapshot. `productBaseUnit` is the product-only storefront unit price (GST incl.)
 * captured when the quote was saved, so we can re-derive the product portion live while keeping
 * the decoration/extra portion (listUnitPrice − productBaseUnit) constant.
 */
export type QuoteLineSnapshot = StoreOrderCartLine & { productBaseUnit?: number | null };

/** Minimal shape needed to re-price a quote line (a superset of cart lines satisfies this). */
export type RepriceableLine = {
  productId?: string;
  quantity: number;
  listUnitPrice?: number;
  unitPrice: number;
  totalPrice?: number;
  specialDealPackageId?: string;
  productBaseUnit?: number | null;
};

type ProductPriceRow = {
  name?: string | null;
  base_price?: unknown;
  sale_price?: unknown;
  supplier_name?: string | null;
  slug?: string | null;
  category?: string | null;
};

/** Current product-only unit price (GST incl., as shown on cards/PDP), or null when unpriced. */
export function currentProductUnitFromRow(row: ProductPriceRow | null | undefined): number | null {
  if (!row) {
    return null;
  }
  const listRetail = storefrontRetailFromSupplierBase(
    row.base_price,
    storefrontRetailProductMetaFromRow(row),
  );
  if (listRetail == null) {
    return null;
  }
  const { displayPrice } = storefrontCardDisplayPrices(
    listRetail,
    row.sale_price,
    getDiscountPercent(String(row.name ?? "")),
  );
  return displayPrice;
}

function storedListUnit(line: RepriceableLine): number {
  const u = line.listUnitPrice ?? line.unitPrice;
  return Number.isFinite(u) ? Math.max(0, u) : 0;
}

export type RepriceResult<T extends RepriceableLine> = {
  /** Lines with current `listUnitPrice`/`unitPrice`/`totalPrice` (after volume discount). */
  lines: Array<T & { listUnitPrice: number; unitPrice: number; totalPrice: number }>;
  /** Product total (GST incl.) after volume discount, in cents. */
  productTotalCents: number;
  /** Total units across lines. */
  totalQuantity: number;
  /** True when any line's live unit price differs from the stored snapshot. */
  changed: boolean;
};

/**
 * Re-price quote lines using current product unit prices. The decoration/extra portion captured
 * at quote time is preserved; only the product portion moves with current supplier pricing. The
 * cart-level volume discount is then re-applied across the lines from current rules.
 */
export function repriceQuoteLines<T extends RepriceableLine>(
  lines: T[],
  currentUnitByProductId: Map<string, number>,
): RepriceResult<T> {
  let changed = false;

  const withCurrentList = lines.map((line) => {
    const storedUnit = storedListUnit(line);
    const productId = (line.productId ?? "").trim();
    const currentProductUnit = productId ? currentUnitByProductId.get(productId) : undefined;
    const snapshotBase = typeof line.productBaseUnit === "number" ? line.productBaseUnit : null;

    let currentListUnit = storedUnit;
    if (snapshotBase != null && currentProductUnit != null) {
      const decorationExtra = Math.max(0, storedUnit - snapshotBase);
      currentListUnit = Math.round((currentProductUnit + decorationExtra) * 100) / 100;
    }
    if (Math.round(currentListUnit * 100) !== Math.round(storedUnit * 100)) {
      changed = true;
    }
    return { line, currentListUnit };
  });

  // Re-apply volume discount across the live list prices.
  const cartLike = withCurrentList.map(({ line, currentListUnit }) => ({
    listUnitPrice: currentListUnit,
    unitPrice: currentListUnit,
    quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
    specialDealPackageId: line.specialDealPackageId,
  }));
  const adjusted = storefrontVolumeAdjustedCartLines(cartLike);

  let productTotalCents = 0;
  let totalQuantity = 0;
  const out = withCurrentList.map(({ line }, idx) => {
    const priced = adjusted[idx];
    const unitPrice = priced?.unitPrice ?? line.unitPrice;
    const totalPrice = priced?.totalPrice ?? line.totalPrice ?? 0;
    productTotalCents += Math.round((totalPrice || 0) * 100);
    totalQuantity += Math.max(0, Math.floor(Number(line.quantity) || 0));
    return {
      ...line,
      listUnitPrice: cartLike[idx]?.listUnitPrice ?? storedListUnit(line),
      unitPrice,
      totalPrice,
    };
  });

  return { lines: out, productTotalCents, totalQuantity, changed };
}

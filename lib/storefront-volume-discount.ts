/**
 * Storefront volume discount:
 * - Default apparel: by cart product subtotal (AUD, incl. GST).
 * - Headwear: by total unit quantity per product (`hw-*`, supplier Headwear).
 */

import { isHeadwearStorefrontProduct } from "@/lib/headwear-pdp-gallery";

/** Headwear quantity tiers (min units inclusive → discount rate). Sorted high → low. */
const HEADWEAR_VOLUME_QUANTITY_TIERS: readonly { minQty: number; rate: number }[] = [
  { minQty: 199, rate: 0.59 },
  { minQty: 99, rate: 0.57 },
  { minQty: 79, rate: 0.55 },
  { minQty: 69, rate: 0.53 },
  { minQty: 59, rate: 0.51 },
  { minQty: 49, rate: 0.48 },
  { minQty: 39, rate: 0.46 },
  { minQty: 29, rate: 0.42 },
  { minQty: 19, rate: 0.34 },
  { minQty: 9, rate: 0.14 },
  { minQty: 5, rate: 0.05 },
];

export function headwearVolumeDiscountRateFromQuantity(quantity: number): number {
  const q = Math.max(0, Math.floor(Number(quantity) || 0));
  for (const tier of HEADWEAR_VOLUME_QUANTITY_TIERS) {
    if (q >= tier.minQty) {
      return tier.rate;
    }
  }
  return 0;
}

export function storefrontVolumeDiscountRateFromSubtotalAud(subtotalAud: number): number {
  const s = Math.max(0, subtotalAud);
  if (s < 300) {
    return 0;
  }
  if (s <= 799) {
    return 0.025;
  }
  if (s <= 1499) {
    return 0.05;
  }
  if (s <= 1999) {
    return 0.075;
  }
  if (s <= 4999) {
    return 0.1;
  }
  if (s <= 9999) {
    return 0.125;
  }
  if (s <= 14999) {
    return 0.15;
  }
  if (s <= 29999) {
    return 0.175;
  }
  return 0.2;
}

function roundAudMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function lineIsFixedDealPackage(line: { specialDealPackageId?: string }): boolean {
  return Boolean((line.specialDealPackageId ?? "").trim());
}

export function isHeadwearVolumeDiscountCartLine(line: {
  supplierName?: string | null;
  productPathSlug?: string | null;
  category?: string | null;
  productName?: string;
}): boolean {
  if (isHeadwearStorefrontProduct(line.productPathSlug, line.supplierName, line.category)) {
    return true;
  }
  return headwearNumericStyleCodeFromProductName(line.productName) != null;
}

function headwearNumericStyleCodeFromProductName(productName?: string): string | null {
  const m = String(productName ?? "").match(/\((\d{3,5})\)\s*$/);
  if (!m) {
    return null;
  }
  const code = m[1]!.trim();
  return /^\d{3,5}$/.test(code) ? code : null;
}

/** Backfill Headwear metadata on legacy cart lines (numeric style codes like (2653)). */
export function inferHeadwearCartLineFields(line: {
  productName?: string;
  productPathSlug?: string | null;
  supplierName?: string | null;
  category?: string | null;
}): {
  productPathSlug?: string;
  supplierName?: string;
  category?: string;
} {
  if (isHeadwearStorefrontProduct(line.productPathSlug, line.supplierName, line.category)) {
    return {};
  }
  const code = headwearNumericStyleCodeFromProductName(line.productName);
  if (!code) {
    return {};
  }
  return {
    productPathSlug: `hw-${code}`,
    supplierName: line.supplierName?.trim() || "Headwear",
    category: line.category?.trim() || "Head wear",
  };
}

/** Stable sort: apparel lines first (add order), then Headwear lines (add order). */
export function sortStorefrontCartLinesHeadwearLast<
  T extends {
    supplierName?: string | null;
    productPathSlug?: string | null;
    category?: string | null;
    productName?: string;
  },
>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aHeadwear = isHeadwearVolumeDiscountCartLine(a.item);
      const bHeadwear = isHeadwearVolumeDiscountCartLine(b.item);
      if (aHeadwear !== bHeadwear) {
        return aHeadwear ? 1 : -1;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

type VolumeCartLine = {
  id?: string;
  listUnitPrice?: number;
  unitPrice: number;
  quantity: number;
  totalPrice?: number;
  specialDealPackageId?: string;
  productId?: string;
  supplierName?: string | null;
  productPathSlug?: string | null;
  category?: string | null;
  productName?: string;
};

function volumeCartLinePriceKey(line: VolumeCartLine, items: readonly VolumeCartLine[], fallbackIndex: number): string {
  const id = String(line.id ?? "").trim();
  if (id) {
    return `id:${id}`;
  }
  const idx = items.indexOf(line);
  if (idx >= 0) {
    return `idx:${idx}`;
  }
  return `fallback:${fallbackIndex}`;
}

function storeVolumeLinePrice<T extends VolumeCartLine>(
  line: T,
  price: { unitPrice: number; totalPrice: number },
  items: readonly VolumeCartLine[],
  pricedByKey: Map<string, { unitPrice: number; totalPrice: number }>,
  pricedByLine: WeakMap<VolumeCartLine, { unitPrice: number; totalPrice: number }>,
  fallbackIndex = -1,
): void {
  pricedByLine.set(line, price);
  pricedByKey.set(volumeCartLinePriceKey(line, items, fallbackIndex), price);
}

/** Pre-discount list unit (falls back to stored unit for legacy cart lines). */
export function storefrontCartLineListUnitAud(line: { listUnitPrice?: number; unitPrice: number }): number {
  const u = line.listUnitPrice ?? line.unitPrice;
  return Number.isFinite(u) ? u : 0;
}

export function storefrontCartGrossListSubtotalAud(
  items: readonly {
    listUnitPrice?: number;
    unitPrice: number;
    quantity: number;
    specialDealPackageId?: string;
  }[],
): number {
  let sum = 0;
  for (const it of items) {
    if (lineIsFixedDealPackage(it)) {
      continue;
    }
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    sum += storefrontCartLineListUnitAud(it) * qty;
  }
  return roundAudMoney(sum);
}

function splitCartLinesForVolumeDiscount<T extends VolumeCartLine>(items: readonly T[]): {
  dealLines: T[];
  headwearLines: T[];
  regularLines: T[];
} {
  const dealLines: T[] = [];
  const headwearLines: T[] = [];
  const regularLines: T[] = [];
  for (const it of items) {
    if (lineIsFixedDealPackage(it)) {
      dealLines.push(it);
    } else if (isHeadwearVolumeDiscountCartLine(it)) {
      headwearLines.push(it);
    } else {
      regularLines.push(it);
    }
  }
  return { dealLines, headwearLines, regularLines };
}

function applySubtotalVolumeDiscountToLines<T extends VolumeCartLine>(
  lines: readonly T[],
  rate: number,
): Array<T & { unitPrice: number; totalPrice: number }> {
  const gross = storefrontCartGrossListSubtotalAud(lines);
  const net = roundAudMoney(gross * (1 - rate));
  if (lines.length === 0) {
    return [];
  }
  if (gross <= 0) {
    return lines.map((it) => {
      const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
      const u = storefrontCartLineListUnitAud(it);
      return { ...it, unitPrice: u, totalPrice: roundAudMoney(u * qty) };
    });
  }
  const factor = net / gross;
  let allocated = 0;
  return lines.map((it, idx) => {
    const baseUnit = storefrontCartLineListUnitAud(it);
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    const lineGross = roundAudMoney(baseUnit * qty);
    const isLast = idx === lines.length - 1;
    const lineNet = isLast ? roundAudMoney(net - allocated) : roundAudMoney(lineGross * factor);
    if (!isLast) {
      allocated += lineNet;
    }
    const unitPrice = qty > 0 ? roundAudMoney(lineNet / qty) : roundAudMoney(baseUnit * factor);
    return { ...it, unitPrice, totalPrice: lineNet };
  });
}

/** Headwear: discount rate from combined quantity per `productId`. */
function applyHeadwearVolumeDiscountToLines<T extends VolumeCartLine>(
  lines: readonly T[],
): WeakMap<T, { unitPrice: number; totalPrice: number }> {
  const priced = new WeakMap<T, { unitPrice: number; totalPrice: number }>();
  if (lines.length === 0) {
    return priced;
  }
  const byProduct = new Map<string, T[]>();
  for (const it of lines) {
    const pid = String(it.productId ?? "").trim() || "__headwear";
    const bucket = byProduct.get(pid);
    if (bucket) {
      bucket.push(it);
    } else {
      byProduct.set(pid, [it]);
    }
  }
  for (const group of byProduct.values()) {
    const totalQty = group.reduce(
      (sum, it) => sum + Math.max(0, Math.floor(Number(it.quantity) || 0)),
      0,
    );
    const rate = headwearVolumeDiscountRateFromQuantity(totalQty);
    const adjusted = applySubtotalVolumeDiscountToLines(group, rate);
    for (let i = 0; i < group.length; i++) {
      const src = group[i];
      const row = adjusted[i];
      if (src && row) {
        priced.set(src, { unitPrice: row.unitPrice, totalPrice: row.totalPrice });
      }
    }
  }
  return priced;
}

export function storefrontCartNetProductSubtotalAfterVolumeAud(
  items: readonly VolumeCartLine[],
): {
  gross: number;
  net: number;
  rate: number;
  /** Apparel subtotal-tier volume discount only (Headwear quantity tiers excluded). */
  regularVolumeDiscountAud: number;
} {
  const { dealLines, headwearLines, regularLines } = splitCartLinesForVolumeDiscount(items);

  let dealNet = 0;
  for (const it of dealLines) {
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    const tp =
      typeof it.totalPrice === "number" && Number.isFinite(it.totalPrice)
        ? it.totalPrice
        : storefrontCartLineListUnitAud(it) * qty;
    dealNet += tp;
  }

  const grossHeadwear = storefrontCartGrossListSubtotalAud(headwearLines);
  const headwearAdjusted = applyHeadwearVolumeDiscountToLines(headwearLines);
  const netHeadwear = headwearLines.reduce((s, it) => s + (headwearAdjusted.get(it)?.totalPrice ?? 0), 0);

  const grossRegular = storefrontCartGrossListSubtotalAud(regularLines);
  const regularRate = storefrontVolumeDiscountRateFromSubtotalAud(grossRegular);
  const netRegular = roundAudMoney(grossRegular * (1 - regularRate));
  const regularVolumeDiscountAud = roundAudMoney(grossRegular - netRegular);

  const gross = roundAudMoney(grossHeadwear + grossRegular + dealNet);
  const net = roundAudMoney(netHeadwear + netRegular + dealNet);
  const rate = gross > 0 ? roundAudMoney(1 - net / gross) : 0;

  return { gross, net, rate, regularVolumeDiscountAud };
}

/** Volume-adjusted unit/total keyed by cart line `id` (never by display index). */
export function volumeAdjustedCartLinePricesById<T extends VolumeCartLine & { id?: string }>(
  items: readonly T[],
): Map<string, { unitPrice: number; totalPrice: number }> {
  const map = new Map<string, { unitPrice: number; totalPrice: number }>();
  for (const row of storefrontVolumeAdjustedCartLines(items)) {
    const id = String(row.id ?? "").trim();
    if (!id) {
      continue;
    }
    const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
    map.set(id, {
      totalPrice: row.totalPrice,
      unitPrice: qty > 0 ? roundAudMoney(row.totalPrice / qty) : row.unitPrice,
    });
  }
  return map;
}

/**
 * Split cart-level volume discount across lines proportionally (last line absorbs rounding).
 * Use for Stripe line items and `store_order_items` so line totals sum to the discounted subtotal.
 * Returned array matches `items` order (not regrouped by line type).
 */
export function storefrontVolumeAdjustedCartLines<
  T extends VolumeCartLine,
>(items: readonly T[]): Array<T & { unitPrice: number; totalPrice: number }> {
  if (items.length === 0) {
    return [];
  }

  const { dealLines, headwearLines, regularLines } = splitCartLinesForVolumeDiscount(items);
  const pricedByKey = new Map<string, { unitPrice: number; totalPrice: number }>();
  const pricedByLine = new WeakMap<VolumeCartLine, { unitPrice: number; totalPrice: number }>();

  for (const it of dealLines) {
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    const u = storefrontCartLineListUnitAud(it);
    const totalPrice =
      typeof it.totalPrice === "number" && Number.isFinite(it.totalPrice)
        ? roundAudMoney(it.totalPrice)
        : roundAudMoney(u * qty);
    const unitPrice = qty > 0 ? roundAudMoney(totalPrice / qty) : u;
    storeVolumeLinePrice(it, { unitPrice, totalPrice }, items, pricedByKey, pricedByLine);
  }

  const grossRegular = storefrontCartGrossListSubtotalAud(regularLines);
  const regularRate = storefrontVolumeDiscountRateFromSubtotalAud(grossRegular);
  const regularOut = applySubtotalVolumeDiscountToLines(regularLines, regularRate);
  for (let i = 0; i < regularLines.length; i++) {
    const src = regularLines[i];
    const row = regularOut[i];
    if (src && row) {
      storeVolumeLinePrice(src, { unitPrice: row.unitPrice, totalPrice: row.totalPrice }, items, pricedByKey, pricedByLine, i);
    }
  }

  const headwearPrices = applyHeadwearVolumeDiscountToLines(headwearLines);
  for (const src of headwearLines) {
    const row = headwearPrices.get(src);
    if (row) {
      storeVolumeLinePrice(src, row, items, pricedByKey, pricedByLine);
    }
  }

  return items.map((it, idx) => {
    const priced =
      pricedByKey.get(volumeCartLinePriceKey(it, items, idx)) ??
      pricedByLine.get(it);
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    if (priced) {
      const totalPrice = priced.totalPrice;
      const unitPrice = qty > 0 ? roundAudMoney(totalPrice / qty) : priced.unitPrice;
      return { ...it, unitPrice, totalPrice };
    }
    const u = storefrontCartLineListUnitAud(it);
    const totalPrice = roundAudMoney(u * qty);
    const unitPrice = qty > 0 ? roundAudMoney(totalPrice / qty) : u;
    return { ...it, unitPrice, totalPrice };
  });
}

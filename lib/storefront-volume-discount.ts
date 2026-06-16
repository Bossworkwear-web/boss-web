/**
 * Storefront volume discount:
 * - Default apparel: by cart product subtotal (AUD, incl. GST).
 * - Headwear: by total unit quantity per product (`hw-*`, supplier Headwear).
 */

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
}): boolean {
  const sup = String(line.supplierName ?? "")
    .trim()
    .toLowerCase();
  if (sup === "headwear" || sup === "head wear") {
    return true;
  }
  const path = String(line.productPathSlug ?? "")
    .trim()
    .toLowerCase();
  return path.startsWith("hw-");
}

type VolumeCartLine = {
  listUnitPrice?: number;
  unitPrice: number;
  quantity: number;
  totalPrice?: number;
  specialDealPackageId?: string;
  productId?: string;
  supplierName?: string | null;
  productPathSlug?: string | null;
};

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
): Array<T & { unitPrice: number; totalPrice: number }> {
  if (lines.length === 0) {
    return [];
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
  const out: Array<T & { unitPrice: number; totalPrice: number }> = [];
  for (const group of byProduct.values()) {
    const totalQty = group.reduce(
      (sum, it) => sum + Math.max(0, Math.floor(Number(it.quantity) || 0)),
      0,
    );
    const rate = headwearVolumeDiscountRateFromQuantity(totalQty);
    out.push(...applySubtotalVolumeDiscountToLines(group, rate));
  }
  return out;
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
  const netHeadwear = headwearAdjusted.reduce((s, it) => s + it.totalPrice, 0);

  const grossRegular = storefrontCartGrossListSubtotalAud(regularLines);
  const regularRate = storefrontVolumeDiscountRateFromSubtotalAud(grossRegular);
  const netRegular = roundAudMoney(grossRegular * (1 - regularRate));
  const regularVolumeDiscountAud = roundAudMoney(grossRegular - netRegular);

  const gross = roundAudMoney(grossHeadwear + grossRegular + dealNet);
  const net = roundAudMoney(netHeadwear + netRegular + dealNet);
  const rate = gross > 0 ? roundAudMoney(1 - net / gross) : 0;

  return { gross, net, rate, regularVolumeDiscountAud };
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
  const pricedByLine = new WeakMap<T, { unitPrice: number; totalPrice: number }>();

  for (const it of dealLines) {
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    const u = storefrontCartLineListUnitAud(it);
    const totalPrice =
      typeof it.totalPrice === "number" && Number.isFinite(it.totalPrice)
        ? roundAudMoney(it.totalPrice)
        : roundAudMoney(u * qty);
    const unitPrice = qty > 0 ? roundAudMoney(totalPrice / qty) : u;
    pricedByLine.set(it, { unitPrice, totalPrice });
  }

  const grossRegular = storefrontCartGrossListSubtotalAud(regularLines);
  const regularRate = storefrontVolumeDiscountRateFromSubtotalAud(grossRegular);
  const regularOut = applySubtotalVolumeDiscountToLines(regularLines, regularRate);
  for (let i = 0; i < regularLines.length; i++) {
    const row = regularOut[i];
    const src = regularLines[i];
    if (row && src) {
      pricedByLine.set(src, { unitPrice: row.unitPrice, totalPrice: row.totalPrice });
    }
  }

  const headwearOut = applyHeadwearVolumeDiscountToLines(headwearLines);
  for (let i = 0; i < headwearLines.length; i++) {
    const row = headwearOut[i];
    const src = headwearLines[i];
    if (row && src) {
      pricedByLine.set(src, { unitPrice: row.unitPrice, totalPrice: row.totalPrice });
    }
  }

  return items.map((it) => {
    const priced = pricedByLine.get(it);
    if (priced) {
      return { ...it, ...priced };
    }
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    const u = storefrontCartLineListUnitAud(it);
    const totalPrice = roundAudMoney(u * qty);
    const unitPrice = qty > 0 ? roundAudMoney(totalPrice / qty) : u;
    return { ...it, unitPrice, totalPrice };
  });
}

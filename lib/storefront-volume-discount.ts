/**
 * Storefront volume discount by **cart / order product subtotal (AUD, incl. GST as shown on PDP)**.
 * Below the first tier there is no discount.
 */

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

export function storefrontCartNetProductSubtotalAfterVolumeAud(
  items: readonly {
    listUnitPrice?: number;
    unitPrice: number;
    quantity: number;
    totalPrice?: number;
    specialDealPackageId?: string;
  }[],
): { gross: number; net: number; rate: number } {
  const regular: Array<(typeof items)[number]> = [];
  let dealNet = 0;
  for (const it of items) {
    if (lineIsFixedDealPackage(it)) {
      const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
      const tp =
        typeof it.totalPrice === "number" && Number.isFinite(it.totalPrice)
          ? it.totalPrice
          : storefrontCartLineListUnitAud(it) * qty;
      dealNet += tp;
    } else {
      regular.push(it);
    }
  }
  const grossRegular = storefrontCartGrossListSubtotalAud(regular);
  const rate = storefrontVolumeDiscountRateFromSubtotalAud(grossRegular);
  const netRegular = roundAudMoney(grossRegular * (1 - rate));
  const gross = roundAudMoney(grossRegular + dealNet);
  const net = roundAudMoney(netRegular + dealNet);
  return { gross, net, rate };
}

/**
 * Split cart-level volume discount across lines proportionally (last line absorbs rounding).
 * Use for Stripe line items and `store_order_items` so line totals sum to the discounted subtotal.
 */
export function storefrontVolumeAdjustedCartLines<
  T extends {
    listUnitPrice?: number;
    unitPrice: number;
    quantity: number;
    totalPrice?: number;
    specialDealPackageId?: string;
  },
>(items: readonly T[]): Array<T & { unitPrice: number; totalPrice: number }> {
  if (items.length === 0) {
    return [];
  }

  const dealLines: T[] = [];
  const regularLines: T[] = [];
  for (const it of items) {
    if (lineIsFixedDealPackage(it)) {
      dealLines.push(it);
    } else {
      regularLines.push(it);
    }
  }

  const passThroughDeal = dealLines.map((it) => {
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    const u = storefrontCartLineListUnitAud(it);
    const totalPrice =
      typeof it.totalPrice === "number" && Number.isFinite(it.totalPrice)
        ? roundAudMoney(it.totalPrice)
        : roundAudMoney(u * qty);
    const unitPrice = qty > 0 ? roundAudMoney(totalPrice / qty) : u;
    return { ...it, unitPrice, totalPrice };
  });

  const gross = storefrontCartGrossListSubtotalAud(regularLines);
  const rate = storefrontVolumeDiscountRateFromSubtotalAud(gross);
  const net = roundAudMoney(gross * (1 - rate));
  if (regularLines.length === 0) {
    return passThroughDeal;
  }
  if (gross <= 0) {
    const regularOut = regularLines.map((it) => {
      const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
      const u = storefrontCartLineListUnitAud(it);
      return { ...it, unitPrice: u, totalPrice: roundAudMoney(u * qty) };
    });
    return [...regularOut, ...passThroughDeal];
  }

  const factor = net / gross;
  let allocated = 0;
  const regularOut = regularLines.map((it, idx) => {
    const baseUnit = storefrontCartLineListUnitAud(it);
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    const lineGross = roundAudMoney(baseUnit * qty);
    const isLast = idx === regularLines.length - 1;
    const lineNet = isLast ? roundAudMoney(net - allocated) : roundAudMoney(lineGross * factor);
    if (!isLast) {
      allocated += lineNet;
    }
    const unitPrice = qty > 0 ? roundAudMoney(lineNet / qty) : roundAudMoney(baseUnit * factor);
    return { ...it, unitPrice, totalPrice: lineNet };
  });
  return [...regularOut, ...passThroughDeal];
}

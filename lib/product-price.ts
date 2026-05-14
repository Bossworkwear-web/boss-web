/**
 * `products.base_price` = supplier unit cost (공급자 가격).
 * Pre-GST consumer price = 공급가 × 1.7.
 * GST-inclusive before card fee = pre-GST × (1 + GST).
 * Final price shown to customers = that amount × card fee (2%).
 */
export const STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST = 1.7;

/** Australia GST (10%) on top of the pre-GST store price. */
export const STOREFRONT_RETAIL_GST_RATE = 0.1;

/** Card processing surcharge applied after GST-inclusive store price (e.g. 1.02 = +2%). */
export const STOREFRONT_RETAIL_CARD_SURCHARGE_MULTIPLIER = 1.02;

export function storefrontMarkupBeforeGstFromSupplierBase(_supplierBase: number): number {
  return STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST;
}

/** Round to nearest 0.1 (1 decimal place). */
export function roundToStorePrice(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

function storefrontRetailFromSupplierBaseNumber(supplier: number): number {
  const markupBeforeGst = storefrontMarkupBeforeGstFromSupplierBase(supplier);
  const preGst = supplier * markupBeforeGst;
  const gstInclusive = preGst * (1 + STOREFRONT_RETAIL_GST_RATE);
  const retail = gstInclusive * STOREFRONT_RETAIL_CARD_SURCHARGE_MULTIPLIER;
  return roundToStorePrice(retail);
}

/**
 * Given a target storefront retail price (GST incl.), pick a supplier base price that rounds back to it.
 * Searches in 0.01 steps around the ideal base price.
 */
export function supplierBaseFromTargetRetail(targetRetail: number): number {
  if (!Number.isFinite(targetRetail) || targetRetail <= 0) {
    return 0;
  }
  const targetRounded = roundToStorePrice(targetRetail);

  const gstMult = 1 + STOREFRONT_RETAIL_GST_RATE;
  const ideal =
    targetRetail /
    (STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST *
      gstMult *
      STOREFRONT_RETAIL_CARD_SURCHARGE_MULTIPLIER);

  const searchAround = (idealBase: number): number | null => {
    for (let i = -200; i <= 200; i += 1) {
      const base = Math.round((idealBase + i * 0.01) * 100) / 100;
      if (base <= 0) continue;
      if (storefrontRetailFromSupplierBaseNumber(base) === targetRounded) {
        return base;
      }
    }
    return null;
  };

  const hit = searchAround(ideal);
  if (hit != null) return hit;

  return Math.round(ideal * 100) / 100;
}

/** Normalize `products.base_price` from Supabase (number, numeric string, or null). */
export function parseBasePrice(raw: unknown): number | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function basePriceOrFallback(raw: unknown, fallback: number): number {
  return parseBasePrice(raw) ?? fallback;
}

/** Customer-facing unit price from supplier `base_price` (null when price missing). */
export function storefrontRetailFromSupplierBase(raw: unknown): number | null {
  const supplier = parseBasePrice(raw);
  if (supplier == null) {
    return null;
  }
  return storefrontRetailFromSupplierBaseNumber(supplier);
}

/** Same as `storefrontRetailFromSupplierBase` but never null (uses fallback supplier cost). */
export function storefrontRetailFromSupplierBaseOrFallback(raw: unknown, fallbackSupplier: number): number {
  const supplier = basePriceOrFallback(raw, fallbackSupplier);
  return storefrontRetailFromSupplierBaseNumber(supplier);
}

/**
 * Admin-set `products.sale_price` (GST incl., same rounding as list).
 * Active only when strictly below `listRetail` so the struck “was” price is always the real list price.
 */
export function activeManualSaleRetail(listRetail: number, saleRaw: unknown): number | null {
  const n = parseBasePrice(saleRaw);
  if (n == null || !Number.isFinite(n) || n <= 0) {
    return null;
  }
  const rounded = roundToStorePrice(n);
  if (rounded >= listRetail) {
    return null;
  }
  return rounded;
}

/** Category / search cards: manual sale beats name-based `discountPercent`. */
export function storefrontCardDisplayPrices(
  listPrice: number,
  saleRaw: unknown,
  discountPercent: number,
): { strikePrice: number | null; displayPrice: number } {
  const manual = activeManualSaleRetail(listPrice, saleRaw);
  if (manual != null) {
    return { strikePrice: listPrice, displayPrice: manual };
  }
  if (discountPercent > 0) {
    return {
      strikePrice: listPrice,
      displayPrice: roundToStorePrice(listPrice * (1 - discountPercent / 100)),
    };
  }
  return { strikePrice: null, displayPrice: listPrice };
}

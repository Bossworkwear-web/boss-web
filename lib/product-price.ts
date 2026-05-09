/**
 * `products.base_price` = supplier unit cost (공급자 가격).
 * Pre-GST consumer price = 공급가 × markup (tiered).
 * - base_price <= $35 → markup 1.8
 * - $35 < base_price < $80 → markup 1.7
 * - base_price >= $80 → markup 1.6
 * - base_price >= $55 → markup 1.9 (overrides tiers above)
 *
 * When moving to a lower multiplier tier, never allow a price drop at the boundary (monotonic floors).
 * Final price shown to customers = pre-GST × (1 + GST).
 */
export const STOREFRONT_RETAIL_MARKUP_TIER1_THRESHOLD_SUPPLIER = 35; // inclusive (<=)
export const STOREFRONT_RETAIL_MARKUP_TIER2_THRESHOLD_SUPPLIER = 80; // inclusive (>=)
export const STOREFRONT_RETAIL_MARKUP_HIGH_PRICE_THRESHOLD_SUPPLIER = 55; // inclusive (>=)

export const STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER1 = 1.8;
export const STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER2 = 1.7;
export const STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER3 = 1.6;
export const STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_HIGH_PRICE = 1.9;

/** Australia GST (10%) on top of the pre-GST store price. */
export const STOREFRONT_RETAIL_GST_RATE = 0.1;

export function storefrontMarkupBeforeGstFromSupplierBase(supplierBase: number): number {
  if (!Number.isFinite(supplierBase) || supplierBase < 0) {
    return STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER2;
  }
  if (supplierBase >= STOREFRONT_RETAIL_MARKUP_HIGH_PRICE_THRESHOLD_SUPPLIER) {
    return STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_HIGH_PRICE;
  }
  if (supplierBase <= STOREFRONT_RETAIL_MARKUP_TIER1_THRESHOLD_SUPPLIER) {
    return STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER1;
  }
  if (supplierBase >= STOREFRONT_RETAIL_MARKUP_TIER2_THRESHOLD_SUPPLIER) {
    return STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER3;
  }
  return STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER2;
}

/** Round to nearest 0.1 (1 decimal place). */
export function roundToStorePrice(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

function storefrontRetailFromSupplierBaseNumber(supplier: number): number {
  const markupBeforeGst = storefrontMarkupBeforeGstFromSupplierBase(supplier);
  const preGst = supplier * markupBeforeGst;
  const retail = preGst * (1 + STOREFRONT_RETAIL_GST_RATE);
  const rounded = roundToStorePrice(retail);

  // Monotonic floors at tier boundaries where multiplier decreases.
  const gstMult = 1 + STOREFRONT_RETAIL_GST_RATE;

  // Boundary at $35: tier1 (1.8) → tier2 (1.7). Do not allow prices above $35 to drop below the $35 tier1 retail.
  if (supplier > STOREFRONT_RETAIL_MARKUP_TIER1_THRESHOLD_SUPPLIER) {
    const floor35 = roundToStorePrice(
      STOREFRONT_RETAIL_MARKUP_TIER1_THRESHOLD_SUPPLIER *
        STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER1 *
        gstMult,
    );
    if (rounded < floor35) {
      return floor35;
    }
  }

  // Boundary at $80: tier2 (1.7) → tier3 (1.6). Do not allow prices at/above $80 to drop below the $80 tier2 retail.
  if (supplier >= STOREFRONT_RETAIL_MARKUP_TIER2_THRESHOLD_SUPPLIER) {
    const floor80 = roundToStorePrice(
      STOREFRONT_RETAIL_MARKUP_TIER2_THRESHOLD_SUPPLIER *
        STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER2 *
        gstMult,
    );
    return Math.max(rounded, floor80);
  }

  return rounded;
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

  // Tiered pricing means the multiplier depends on the base price. Try all tier ideals, then brute force.
  const gstMult = 1 + STOREFRONT_RETAIL_GST_RATE;
  const idealT1 = targetRetail / (STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER1 * gstMult);
  const idealT2 = targetRetail / (STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER2 * gstMult);
  const idealT3 = targetRetail / (STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER3 * gstMult);
  const idealHigh = targetRetail / (STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_HIGH_PRICE * gstMult);

  const floor35 = roundToStorePrice(
    STOREFRONT_RETAIL_MARKUP_TIER1_THRESHOLD_SUPPLIER *
      STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER1 *
      gstMult,
  );
  const floor80 = roundToStorePrice(
    STOREFRONT_RETAIL_MARKUP_TIER2_THRESHOLD_SUPPLIER *
      STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST_TIER2 *
      gstMult,
  );

  // If the target is exactly a floor value, return the boundary base to keep admin UX stable.
  if (targetRounded === floor35) {
    return STOREFRONT_RETAIL_MARKUP_TIER1_THRESHOLD_SUPPLIER;
  }
  if (targetRounded === floor80) {
    return STOREFRONT_RETAIL_MARKUP_TIER2_THRESHOLD_SUPPLIER;
  }

  const searchAround = (ideal: number): number | null => {
    for (let i = -200; i <= 200; i += 1) {
      const base = Math.round((ideal + i * 0.01) * 100) / 100;
      if (base <= 0) continue;
      if (storefrontRetailFromSupplierBaseNumber(base) === targetRounded) {
        return base;
      }
    }
    return null;
  };

  const hitT1 = searchAround(idealT1);
  if (hitT1 != null) return hitT1;
  const hitT2 = searchAround(idealT2);
  if (hitT2 != null) return hitT2;
  const hitT3 = searchAround(idealT3);
  if (hitT3 != null) return hitT3;
  const hitHigh = searchAround(idealHigh);
  if (hitHigh != null) return hitHigh;

  // Fallback: choose the ideal that lands closest after rounding.
  const t1Retail = storefrontRetailFromSupplierBaseNumber(Math.max(0.01, idealT1));
  const t2Retail = storefrontRetailFromSupplierBaseNumber(Math.max(0.01, idealT2));
  const t3Retail = storefrontRetailFromSupplierBaseNumber(Math.max(0.01, idealT3));
  const tHighRetail = storefrontRetailFromSupplierBaseNumber(Math.max(0.01, idealHigh));
  const cands: Array<{ ideal: number; retail: number }> = [
    { ideal: idealT1, retail: t1Retail },
    { ideal: idealT2, retail: t2Retail },
    { ideal: idealT3, retail: t3Retail },
    { ideal: idealHigh, retail: tHighRetail },
  ];
  cands.sort((a, b) => Math.abs(a.retail - targetRounded) - Math.abs(b.retail - targetRounded));
  const pick = cands[0]?.ideal ?? idealT2;
  return Math.round(pick * 100) / 100;
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

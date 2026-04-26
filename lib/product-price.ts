/**
 * `products.base_price` = supplier unit cost (공급자 가격).
 * Pre-GST consumer price = 공급가 × 2.0.
 * Final price shown to customers = pre-GST × (1 + GST) = 공급가 × 2.2 (GST 10% 포함).
 */
export const STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST = 2.0;

/** Australia GST (10%) on top of the pre-GST store price. */
export const STOREFRONT_RETAIL_GST_RATE = 0.1;

/** Combined multiplier (공급가 → GST 포함 판매가). */
export const STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER =
  STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST * (1 + STOREFRONT_RETAIL_GST_RATE);

/** Round to nearest 0.1 (1 decimal place). */
export function roundToStorePrice(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
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
  const ideal = targetRetail / STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER;
  // Search within ±$2.00 of the ideal in 0.01 steps (enough to compensate rounding effects).
  for (let i = -200; i <= 200; i += 1) {
    const base = Math.round((ideal + i * 0.01) * 100) / 100;
    if (base <= 0) continue;
    const retail = roundToStorePrice(base * STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER);
    if (retail === targetRounded) {
      return base;
    }
  }
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
  return roundToStorePrice(supplier * STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER);
}

/** Same as `storefrontRetailFromSupplierBase` but never null (uses fallback supplier cost). */
export function storefrontRetailFromSupplierBaseOrFallback(raw: unknown, fallbackSupplier: number): number {
  const supplier = basePriceOrFallback(raw, fallbackSupplier);
  return roundToStorePrice(supplier * STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER);
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

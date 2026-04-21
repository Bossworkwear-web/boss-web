/**
 * `products.base_price` = supplier unit cost (공급자 가격).
 * Pre-GST consumer price = 공급가 × 1.5.
 * Final price shown to customers = pre-GST × (1 + GST) = 공급가 × 1.65 (GST 10% 포함).
 */
export const STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST = 1.5;

/** Australia GST (10%) on top of the pre-GST store price. */
export const STOREFRONT_RETAIL_GST_RATE = 0.1;

/** Combined multiplier (공급가 → GST 포함 판매가). */
export const STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER =
  STOREFRONT_RETAIL_MARKUP_MULTIPLIER_BEFORE_GST * (1 + STOREFRONT_RETAIL_GST_RATE);

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
  return Math.round(supplier * STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER * 100) / 100;
}

/** Same as `storefrontRetailFromSupplierBase` but never null (uses fallback supplier cost). */
export function storefrontRetailFromSupplierBaseOrFallback(raw: unknown, fallbackSupplier: number): number {
  const supplier = basePriceOrFallback(raw, fallbackSupplier);
  return Math.round(supplier * STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER * 100) / 100;
}

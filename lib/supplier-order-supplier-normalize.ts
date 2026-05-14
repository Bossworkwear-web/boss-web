const FB_ONLY = /^fb$/i;
const FASHION_BIZ = /^fashion\s*biz$/i;

/**
 * Supplier order lines: `FB` (any case) and full "Fashion Biz" spellings normalize to **Fashion Biz**.
 * All other values are uppercased (existing sheet behavior).
 */
export function normalizeSupplierOrderLineSupplierValue(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) {
    return "";
  }
  if (FB_ONLY.test(t) || FASHION_BIZ.test(t)) {
    return "Fashion Biz";
  }
  return t.toUpperCase();
}

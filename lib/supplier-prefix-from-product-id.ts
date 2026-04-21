const PRODUCT_UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * Supplier daily sheet: derive short supplier code from `product_id` when it has 2+ hyphen
 * segments and the first is alphanumeric (1–12 chars), e.g. `fb-bizcare-cpt451ms` → `FB`,
 * `work-shirt` → `WORK`.
 * Returns `null` for UUID ids, single-segment ids, or odd shapes.
 */
export function supplierPrefixFromSheetProductId(productIdRaw: string): string | null {
  const s = productIdRaw.trim();
  if (!s || PRODUCT_UUID_RE.test(s)) {
    return null;
  }
  const parts = s.split("-").filter((p) => p.length > 0);
  if (parts.length < 2) {
    return null;
  }
  const head = parts[0] ?? "";
  if (!/^[a-z0-9]{1,12}$/i.test(head)) {
    return null;
  }
  return head.toUpperCase();
}

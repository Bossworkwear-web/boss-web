/** Same value as DB `order_scan_code` when migration applied (UUID without hyphens). */
export function storeOrderScanPayloadFromId(storeOrderId: string): string {
  return storeOrderId.replace(/-/g, "");
}

/**
 * Normalizes `store_orders.id` from URL params (hyphenated lowercase UUID).
 * Returns null if the string cannot be interpreted as a 128-bit UUID.
 */
export function normalizeStoreOrderUuidParam(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const hex = t.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

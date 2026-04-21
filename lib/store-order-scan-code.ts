/** Same value as DB `order_scan_code` when migration applied (UUID without hyphens). */
export function storeOrderScanPayloadFromId(storeOrderId: string): string {
  return storeOrderId.replace(/-/g, "");
}

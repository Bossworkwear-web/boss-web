/** Complete Orders → VIEW: pre-process document hub for one store order. */
export function completeOrderDocumentsHref(storeOrderId: string, listDate: string, orderNumber: string): string {
  const q = new URLSearchParams();
  const ld = listDate.trim();
  const oid = orderNumber.trim();
  if (ld) q.set("list_date", ld);
  if (oid) q.set("customer_order_id", oid);
  const qs = q.toString();
  const path = `/admin/complete-orders/${encodeURIComponent(storeOrderId)}/documents`;
  return qs ? `${path}?${qs}` : path;
}

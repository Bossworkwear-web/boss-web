/** Same query shape as Quality Control → Open Quality Check sheet (`list_date`, `customer_order_id`). */
export function qualityCheckSheetHref(listDate: string, orderNumber: string): string {
  const q = new URLSearchParams();
  const ld = listDate.trim();
  const oid = orderNumber.trim();
  if (ld) {
    q.set("list_date", ld);
  }
  if (oid) {
    q.set("customer_order_id", oid);
  }
  const s = q.toString();
  return s ? `/admin/quality-check-sheet?${s}` : "/admin/quality-check-sheet";
}

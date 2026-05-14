/**
 * Warehouse Manager hub links to supplier orders in print / read-only mode.
 * Cookie name must stay in sync with root `middleware.ts` (Edge cannot import `@/lib/...` there).
 */
export const SUPPLIER_ORDERS_WAREHOUSE_MANAGER_COOKIE = "boss_supplier_orders_wm";

export const WAREHOUSE_MANAGER_QUERY_PARAM = "warehouse_manager";

export function warehouseManagerViewFromSearchParam(v: string | string[] | undefined | null): boolean {
  if (v == null) return false;
  const s = Array.isArray(v) ? v[0] : v;
  if (s == null) return false;
  const t = String(s).trim();
  return t === "1" || t.toLowerCase() === "true";
}

/** Append or replace `warehouse_manager=1` for admin Supplier orders links from Warehouse Manager. */
export function appendWarehouseManagerSupplierOrdersHref(href: string): string {
  const h = (href ?? "").trim();
  if (!h.startsWith("/")) return h;
  const qMark = h.indexOf("?");
  const path = qMark === -1 ? h : h.slice(0, qMark);
  const existing = qMark === -1 ? "" : h.slice(qMark + 1);
  const q = new URLSearchParams(existing);
  q.set(WAREHOUSE_MANAGER_QUERY_PARAM, "1");
  const s = q.toString();
  return `${path}?${s}`;
}

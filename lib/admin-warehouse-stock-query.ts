/** Query flag when opening Stock from Dashboard → Warehouse (simplified columns). */
export const WAREHOUSE_STOCK_QUERY_PARAM = "warehouse";

export function warehouseStockViewFromSearchParam(v: string | string[] | undefined | null): boolean {
  if (v == null) return false;
  const s = Array.isArray(v) ? v[0] : v;
  if (s == null) return false;
  const t = String(s).trim();
  return t === "1" || t.toLowerCase() === "true";
}

export function appendWarehouseStockHref(href: string): string {
  const h = (href ?? "").trim();
  if (!h.startsWith("/")) return h;
  const qMark = h.indexOf("?");
  const path = qMark === -1 ? h : h.slice(0, qMark);
  const existing = qMark === -1 ? "" : h.slice(qMark + 1);
  const q = new URLSearchParams(existing);
  q.set(WAREHOUSE_STOCK_QUERY_PARAM, "1");
  const s = q.toString();
  return `${path}?${s}`;
}

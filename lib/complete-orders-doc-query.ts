/** Query flag when opening admin links from Complete Orders → Pre-process documents (read-only reference). */
export const COMPLETE_ORDERS_DOC_QUERY_PARAM = "complete_orders_doc";

export function appendCompleteOrdersDocQuery(href: string): string {
  const h = (href ?? "").trim();
  if (!h.startsWith("/")) return h;
  const qMark = h.indexOf("?");
  const path = qMark === -1 ? h : h.slice(0, qMark);
  const existing = qMark === -1 ? "" : h.slice(qMark + 1);
  const q = new URLSearchParams(existing);
  q.set(COMPLETE_ORDERS_DOC_QUERY_PARAM, "1");
  const s = q.toString();
  return `${path}?${s}`;
}

export function completeOrdersDocFromSearchParam(v: string | string[] | undefined): boolean {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "1" || s === "true";
}

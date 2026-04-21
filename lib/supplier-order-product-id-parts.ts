/**
 * Split supplier-sheet `product_id` for display when it has 2+ hyphen segments.
 * `fb-bizcare-cpt451ms` → `{ head: "fb-bizcare", tail: "cpt451ms" }`.
 */
export function supplierOrderProductIdHeadTail(raw: string): { head: string; tail: string } | null {
  const parts = (raw ?? "").split("-").filter((p) => p.length > 0);
  if (parts.length < 2) {
    return null;
  }
  const tail = parts[parts.length - 1] ?? "";
  const head = parts.slice(0, -1).join("-");
  return { head, tail };
}

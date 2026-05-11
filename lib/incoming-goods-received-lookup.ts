import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getPerthYmd } from "@/lib/perth-calendar";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * For each `store_order_items.id`, returns Perth calendar YYYY-MM-DD when Incoming goods shows that line as fully
 * received (`received_qty` ≥ ordered qty), else `null`. Keys are only the requested ids.
 */
export async function fetchIncomingReceivedYmdByStoreItemIds(
  supabase: SupabaseClient<Database>,
  itemIds: string[],
): Promise<Record<string, string | null>> {
  const ids = [...new Set(itemIds.map((x) => x.trim()).filter((x) => UUID_RE.test(x)))];
  const out: Record<string, string | null> = {};
  if (ids.length === 0) return out;
  for (const id of ids) out[id] = null;

  const { data: items, error: itemsErr } = await supabase.from("store_order_items").select("id, quantity").in("id", ids);
  if (itemsErr || !items) return out;

  const { data: recs, error: recErr } = await supabase
    .from("incoming_goods_receipts")
    .select("store_order_item_id, received_qty, updated_at")
    .in("store_order_item_id", ids);
  if (recErr) return out;

  const recBy = new Map((recs ?? []).map((r) => [String(r.store_order_item_id), r]));

  for (const item of items) {
    const id = String(item.id);
    const qtyOrd = Math.max(0, Math.floor(Number(item.quantity) || 0));
    const rec = recBy.get(id) as { received_qty?: number; updated_at?: string } | undefined;
    const recv = Math.max(0, Math.floor(Number(rec?.received_qty) || 0));
    const complete = qtyOrd > 0 && recv >= qtyOrd;
    if (!complete) {
      out[id] = null;
      continue;
    }
    const ts = rec?.updated_at;
    out[id] = ts ? getPerthYmd(new Date(ts)).ymd : null;
  }
  return out;
}

/** Received column: Incoming goods when linked; otherwise legacy `supplier_order_lines.received_date`. */
export function supplierLineDisplayReceivedYmd(
  row: { store_order_item_id: string | null; received_date: string | null },
  incomingReceivedYmdByStoreItemId: Record<string, string | null> | undefined,
): string | null {
  const sid = row.store_order_item_id?.trim();
  if (
    sid &&
    UUID_RE.test(sid) &&
    incomingReceivedYmdByStoreItemId &&
    Object.prototype.hasOwnProperty.call(incomingReceivedYmdByStoreItemId, sid)
  ) {
    return incomingReceivedYmdByStoreItemId[sid] ?? null;
  }
  return row.received_date ?? null;
}

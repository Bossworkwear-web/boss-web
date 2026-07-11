import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

export type StoreOrderFulfillmentMethod = "Pickup" | "Delivery";

export function storeOrderFulfillmentLabel(pickUp: boolean): StoreOrderFulfillmentMethod {
  return pickUp ? "Pickup" : "Delivery";
}

/**
 * Resolve pickup flags for store order UUIDs.
 * Prefers `store_orders.pick_up` when the column exists; any matching
 * `store_checkout_pending.pick_up = true` also marks the order as pickup
 * (covers pre-migration rows and pending that was never backfilled).
 */
export async function resolveStoreOrderPickUpByIds(
  supabase: SupabaseClient<Database>,
  storeOrderIds: string[],
): Promise<Map<string, boolean>> {
  const ids = [...new Set(storeOrderIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, boolean>();
  for (const id of ids) out.set(id, false);
  if (ids.length === 0) return out;

  const { data: orderRows, error: orderErr } = await supabase
    .from("store_orders")
    .select("id, pick_up")
    .in("id", ids);

  if (!orderErr && orderRows) {
    for (const row of orderRows) {
      out.set(row.id, row.pick_up === true);
    }
  }

  const { data: pendingRows } = await supabase
    .from("store_checkout_pending")
    .select("store_order_id, pick_up")
    .in("store_order_id", ids)
    .eq("pick_up", true);

  for (const row of pendingRows ?? []) {
    const sid = row.store_order_id;
    if (sid) out.set(sid, true);
  }

  return out;
}

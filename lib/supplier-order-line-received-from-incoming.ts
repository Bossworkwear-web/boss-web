import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getPerthYmd } from "@/lib/perth-calendar";
import { resolveSupplierSheetProductIdUpperCaseForStoreItem } from "@/lib/supplier-order-lines-from-store-order";

/**
 * When Incoming goods marks a store line fully received (or not), mirror `received_date` on the linked
 * `supplier_order_lines` row (Perth calendar date, or null when not fully received).
 */
export async function syncSupplierOrderLinesReceivedDateFromIncomingGoods(
  supabase: SupabaseClient<Database>,
  storeOrderItemId: string,
  receivedQty: number,
): Promise<void> {
  const itemId = storeOrderItemId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return;

  const { data: item, error: itemErr } = await supabase
    .from("store_order_items")
    .select("id, order_id, quantity, product_id, product_name, color, size")
    .eq("id", itemId)
    .maybeSingle();

  if (itemErr || !item) return;

  const { data: ord, error: ordErr } = await supabase
    .from("store_orders")
    .select("order_number")
    .eq("id", item.order_id)
    .maybeSingle();

  if (ordErr || !ord?.order_number) return;

  const orderNumber = String(ord.order_number).trim();
  if (!orderNumber) return;

  const qtyOrdered = Math.max(0, Math.floor(Number(item.quantity) || 0));
  const recv = Math.max(0, Math.floor(Number(receivedQty) || 0));
  const complete = qtyOrdered > 0 && recv >= qtyOrdered;
  const receivedDate = complete ? getPerthYmd(new Date()).ymd : null;
  const nowIso = new Date().toISOString();

  const { data: byLink, error: linkErr } = await supabase
    .from("supplier_order_lines")
    .select("id")
    .eq("store_order_item_id", itemId);

  if (!linkErr && byLink && byLink.length > 0) {
    const ids = byLink.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return;
    const { error: updErr } = await supabase
      .from("supplier_order_lines")
      .update({ received_date: receivedDate, updated_at: nowIso })
      .in("id", ids);
    if (updErr) {
      console.error("[incoming goods → supplier orders] update by store_order_item_id failed:", updErr.message);
    }
    return;
  }

  // Legacy rows (before `store_order_item_id`): update only when exactly one line matches.
  let sheetPid: string;
  try {
    sheetPid = await resolveSupplierSheetProductIdUpperCaseForStoreItem(supabase, {
      product_id: String(item.product_id ?? ""),
      product_name: String(item.product_name ?? ""),
    });
  } catch {
    return;
  }

  const colour = (item.color ?? "").trim();
  const size = (item.size ?? "").trim();

  const { data: candidates, error: candErr } = await supabase
    .from("supplier_order_lines")
    .select("id")
    .eq("customer_order_id", orderNumber)
    .eq("product_id", sheetPid)
    .eq("quantity", qtyOrdered)
    .eq("colour", colour)
    .eq("size", size);

  if (candErr || !candidates || candidates.length !== 1) return;

  const onlyId = candidates[0]?.id;
  if (!onlyId) return;

  const { error: updErr2 } = await supabase
    .from("supplier_order_lines")
    .update({ received_date: receivedDate, updated_at: nowIso })
    .eq("id", onlyId);

  if (updErr2) {
    console.error("[incoming goods → supplier orders] fallback update failed:", updErr2.message);
  }
}

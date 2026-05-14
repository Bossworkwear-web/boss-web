import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { syncSupplierOrderLinesReceivedDateFromIncomingGoods } from "@/lib/supplier-order-line-received-from-incoming";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * When Supplier orders line OK is toggled for a web-linked row (`store_order_item_id`), mirror into
 * `incoming_goods_receipts` (full qty when OK, zero when not) so Admin → Incoming goods stays in sync.
 */
export async function applyIncomingGoodsReceiptForSupplierLineOk(
  supabase: SupabaseClient<Database>,
  storeOrderItemId: string,
  lineOk: boolean,
): Promise<void> {
  const itemId = storeOrderItemId.trim();
  if (!UUID_RE.test(itemId)) return;

  const { data: item, error: itemErr } = await supabase.from("store_order_items").select("quantity").eq("id", itemId).maybeSingle();
  if (itemErr || !item) return;

  const qtyOrdered = Math.max(0, Math.floor(Number(item.quantity) || 0));
  const receivedQty = lineOk ? qtyOrdered : 0;

  const { data: rec } = await supabase
    .from("incoming_goods_receipts")
    .select("note")
    .eq("store_order_item_id", itemId)
    .maybeSingle();
  const note = String((rec as { note?: string } | null)?.note ?? "");

  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase.from("incoming_goods_receipts").upsert(
    {
      store_order_item_id: itemId,
      received_qty: receivedQty,
      note,
      updated_at: nowIso,
    },
    { onConflict: "store_order_item_id" },
  );
  if (upErr) {
    console.error("[supplier OK → incoming goods] upsert failed:", upErr.message);
    return;
  }

  await syncSupplierOrderLinesReceivedDateFromIncomingGoods(supabase, itemId, receivedQty);
}

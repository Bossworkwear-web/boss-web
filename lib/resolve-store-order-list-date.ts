import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getPerthYmd } from "@/lib/perth-calendar";

/**
 * Resolve Perth worksheet `list_date` for a store order number when the URL/queue row omitted it.
 * Prefers queue rows, then supplier worksheet lines, then Perth calendar day of order creation.
 */
export async function resolveListDateForStoreOrderNumber(
  supabase: SupabaseClient<Database>,
  orderNumber: string,
): Promise<string> {
  const oid = orderNumber.trim();
  if (!oid) {
    return "";
  }

  const { data: order } = await supabase
    .from("store_orders")
    .select("id, created_at")
    .eq("order_number", oid)
    .maybeSingle();

  if (order?.id) {
    const { data: qc } = await supabase
      .from("click_up_qc_queue")
      .select("list_date")
      .eq("store_order_id", order.id)
      .maybeSingle();
    const qcDate = (qc?.list_date ?? "").trim();
    if (qcDate) {
      return qcDate;
    }

    const { data: prod } = await supabase
      .from("click_up_production_queue")
      .select("list_date")
      .eq("store_order_id", order.id)
      .maybeSingle();
    const prodDate = (prod?.list_date ?? "").trim();
    if (prodDate) {
      return prodDate;
    }

    const { data: disp } = await supabase
      .from("click_up_dispatch_queue")
      .select("list_date")
      .eq("store_order_id", order.id)
      .maybeSingle();
    const dispDate = (disp?.list_date ?? "").trim();
    if (dispDate) {
      return dispDate;
    }
  }

  const { data: lines } = await supabase
    .from("supplier_order_lines")
    .select("list_date")
    .eq("customer_order_id", oid)
    .order("list_date", { ascending: false })
    .limit(1);
  const lineDate = (lines?.[0]?.list_date ?? "").trim();
  if (lineDate) {
    return lineDate;
  }

  if (order?.created_at) {
    return getPerthYmd(new Date(order.created_at)).ymd;
  }

  return "";
}

/** If QC queue has an empty list_date, backfill from a resolved worksheet date. */
export async function backfillQcQueueListDateIfEmpty(
  supabase: SupabaseClient<Database>,
  storeOrderId: string,
  listDate: string,
): Promise<void> {
  const id = storeOrderId.trim();
  const ld = listDate.trim();
  if (!id || !ld) {
    return;
  }
  const { data } = await supabase
    .from("click_up_qc_queue")
    .select("list_date")
    .eq("store_order_id", id)
    .maybeSingle();
  if (!data || (data.list_date ?? "").trim()) {
    return;
  }
  await supabase.from("click_up_qc_queue").update({ list_date: ld }).eq("store_order_id", id);
}

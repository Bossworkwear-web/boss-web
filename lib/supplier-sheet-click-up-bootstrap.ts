import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import {
  classifySupplierOrderLinesError,
  supplierOrderLinesMutationErrorMessage,
} from "@/lib/supplier-order-lines-db-error";

function parseListDateYmd(v: string): string | null {
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

type SupplierSheetSupabase = SupabaseClient<Database>;

/** Bump `updated_at` on supplier lines for orders already in Production/QC/Dispatch (not Completed). */
async function touchSupplierOrderLinesForProcessingStoreOrders(
  supabase: SupplierSheetSupabase,
  listDate: string,
): Promise<void> {
  const { data: lineRows } = await supabase
    .from("supplier_order_lines")
    .select("customer_order_id")
    .eq("list_date", listDate);

  const distinctOrderNumbers: string[] = [];
  const seen = new Set<string>();
  for (const lr of lineRows ?? []) {
    const o = (lr.customer_order_id ?? "").trim();
    if (!o || seen.has(o)) continue;
    seen.add(o);
    distinctOrderNumbers.push(o);
  }
  if (distinctOrderNumbers.length === 0) return;

  const { data: storeRows } = await supabase
    .from("store_orders")
    .select("id, order_number")
    .in("order_number", distinctOrderNumbers);

  const idByNumber = new Map<string, string>();
  for (const r of storeRows ?? []) {
    idByNumber.set(r.order_number, r.id);
  }
  const storeIds = [...new Set([...idByNumber.values()])];
  if (storeIds.length === 0) return;

  const { data: completeRows } = await supabase
    .from("click_up_complete_orders_queue")
    .select("store_order_id")
    .in("store_order_id", storeIds);
  const completeSet = new Set((completeRows ?? []).map((r) => r.store_order_id));

  const processingIds = new Set<string>();
  for (const table of ["click_up_production_queue", "click_up_qc_queue", "click_up_dispatch_queue"] as const) {
    const { data: qRows } = await supabase.from(table).select("store_order_id").in("store_order_id", storeIds);
    for (const r of qRows ?? []) {
      if (!completeSet.has(r.store_order_id)) {
        processingIds.add(r.store_order_id);
      }
    }
  }
  if (processingIds.size === 0) return;

  const nowIso = new Date().toISOString();
  for (const on of distinctOrderNumbers) {
    const sid = idByNumber.get(on);
    if (!sid || !processingIds.has(sid)) continue;
    await supabase
      .from("supplier_order_lines")
      .update({ updated_at: nowIso })
      .eq("list_date", listDate)
      .eq("customer_order_id", on);
  }
}

/**
 * Marks the Perth supplier worksheet date as ready and ensures it appears on Click Up → Click up sheet list
 * (same effect as the removed “Ready for Processing” checkbox, and used after web checkout).
 */
export async function ensureClickUpSheetListForSupplierListDate(
  supabase: SupplierSheetSupabase,
  listDateYmd: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const listDate = parseListDateYmd(listDateYmd);
  if (!listDate) {
    return { ok: false, error: "Invalid worksheet date" };
  }

  const nowIso = new Date().toISOString();
  const sheetPayload: Database["public"]["Tables"]["supplier_daily_sheets"]["Insert"] = {
    list_date: listDate,
    ready_for_processing: true,
    updated_at: nowIso,
  };
  const { error: sheetErr } = await supabase.from("supplier_daily_sheets").upsert(sheetPayload, {
    onConflict: "list_date",
  });
  if (sheetErr) {
    return { ok: false, error: supplierOrderLinesMutationErrorMessage(sheetErr) };
  }

  const listPayload: Database["public"]["Tables"]["click_up_sheet_list"]["Insert"] = {
    list_date: listDate,
    created_at: nowIso,
  };
  const { error: listErr } = await supabase.from("click_up_sheet_list").upsert(listPayload, {
    onConflict: "list_date",
  });
  if (listErr) {
    if (classifySupplierOrderLinesError(listErr) !== "missing_click_up_sheet_list_table") {
      await supabase
        .from("supplier_daily_sheets")
        .update({ ready_for_processing: false, updated_at: nowIso })
        .eq("list_date", listDate);
      return { ok: false, error: supplierOrderLinesMutationErrorMessage(listErr) };
    }
  }

  await touchSupplierOrderLinesForProcessingStoreOrders(supabase, listDate);
  return { ok: true };
}

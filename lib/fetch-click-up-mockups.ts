import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";

const CLICK_UP_SHEET_IMAGES_BUCKET = "click-up-sheet-images";

/** Same shape as admin `ClickUpSheetImageDto` for mock-up rows (any Perth sheet date). */
export type ClickUpMockupImageForOrder = {
  id: string;
  list_date: string;
  customer_order_id: string;
  storage_path: string;
  public_url: string;
  sort_order: number;
  created_at: string;
  is_mockup: boolean;
  mockup_decorate_methods: string | null;
  mockup_memo: string | null;
};

export type QueryClickUpMockupsResult =
  | { ok: true; rows: ClickUpMockupImageForOrder[] }
  | { ok: false; error: string };

/**
 * Load mock-up images for a store order number. No auth — caller must use a service-role client
 * (e.g. order tracking page) or enforce auth separately (e.g. admin actions).
 */
export async function queryClickUpMockupImagesByCustomerOrderId(
  supabase: SupabaseClient<Database>,
  customerOrderId: string,
): Promise<QueryClickUpMockupsResult> {
  const id = customerOrderId.trim();
  if (!id) {
    return { ok: true, rows: [] };
  }

  const { data, error } = await supabase
    .from("click_up_sheet_images")
    .select("*")
    .eq("customer_order_id", id)
    .eq("is_mockup", true)
    .order("list_date", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows: ClickUpMockupImageForOrder[] = (data ?? []).map((r) => ({
    id: r.id,
    list_date: r.list_date,
    customer_order_id: r.customer_order_id ?? "",
    storage_path: r.storage_path,
    public_url: publicStorageObjectUrl(CLICK_UP_SHEET_IMAGES_BUCKET, r.storage_path),
    sort_order: r.sort_order,
    created_at: r.created_at,
    is_mockup: Boolean(r.is_mockup),
    mockup_decorate_methods: r.mockup_decorate_methods ?? null,
    mockup_memo: r.mockup_memo ?? null,
  }));

  return { ok: true, rows };
}

/**
 * Mock-ups for this customer order ID, plus the **source** order’s mock-ups when this row was created via Reorder
 * (`store_orders.reordered_from_store_order_id`). Dedupes by `storage_path`.
 */
export async function queryClickUpMockupImagesByCustomerOrderIdIncludingReorder(
  supabase: SupabaseClient<Database>,
  orderNumber: string,
): Promise<QueryClickUpMockupsResult> {
  const on = orderNumber.trim();
  if (!on) {
    return { ok: true, rows: [] };
  }

  const current = await queryClickUpMockupImagesByCustomerOrderId(supabase, on);
  if (!current.ok) {
    return current;
  }

  const { data: orderRow, error: ordErr } = await supabase
    .from("store_orders")
    .select("reordered_from_store_order_id")
    .eq("order_number", on)
    .maybeSingle();

  if (ordErr || !orderRow) {
    return current;
  }

  const prevId = (orderRow.reordered_from_store_order_id ?? "").trim();
  if (!prevId || !/^[0-9a-f-]{36}$/i.test(prevId)) {
    return current;
  }

  const { data: srcOrder } = await supabase
    .from("store_orders")
    .select("order_number")
    .eq("id", prevId)
    .maybeSingle();

  const prevNum = (srcOrder?.order_number ?? "").trim();
  if (!prevNum || prevNum === on) {
    return current;
  }

  const prior = await queryClickUpMockupImagesByCustomerOrderId(supabase, prevNum);
  if (!prior.ok) {
    return current;
  }

  const seenPaths = new Set(current.rows.map((r) => r.storage_path));
  const merged = [...current.rows];
  for (const row of prior.rows) {
    if (!row.storage_path || seenPaths.has(row.storage_path)) {
      continue;
    }
    seenPaths.add(row.storage_path);
    merged.push(row);
  }
  return { ok: true, rows: merged };
}

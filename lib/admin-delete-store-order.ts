import { createSupabaseAdminClient } from "@/lib/supabase";

const CLICK_UP_SHEET_IMAGES_BUCKET = "click-up-sheet-images";
const PRODUCTION_ORDER_ASSETS_TABLE = "production_order_assets";
const DEFAULT_PRODUCTION_ASSETS_BUCKET = "production-order-assets";

function isMissingTableError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("could not find the table") || m.includes("schema cache");
}

async function deleteClickUpSheetImagesForCustomerOrderId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  customerOrderId: string,
): Promise<void> {
  if (!customerOrderId) return;

  const { data: rows, error } = await supabase
    .from("click_up_sheet_images")
    .select("storage_path")
    .eq("customer_order_id", customerOrderId);

  if (error) {
    if (!isMissingTableError(error.message)) {
      console.error("[deleteStoreOrder] click_up_sheet_images select:", error.message);
    }
    return;
  }

  const paths = (rows ?? [])
    .map((r: { storage_path?: string }) => (r.storage_path ?? "").trim())
    .filter(Boolean);
  if (paths.length > 0) {
    const { error: rmErr } = await supabase.storage.from(CLICK_UP_SHEET_IMAGES_BUCKET).remove(paths);
    if (rmErr) {
      console.error("[deleteStoreOrder] click_up_sheet_images storage remove:", rmErr.message);
    }
  }

  const { error: delErr } = await supabase
    .from("click_up_sheet_images")
    .delete()
    .eq("customer_order_id", customerOrderId);
  if (delErr && !isMissingTableError(delErr.message)) {
    console.error("[deleteStoreOrder] click_up_sheet_images delete:", delErr.message);
  }
}

async function deleteProductionOrderAssetsForStoreOrderId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storeOrderUuid: string,
): Promise<void> {
  const { data: assets, error } = await supabase
    .from(PRODUCTION_ORDER_ASSETS_TABLE)
    .select("storage_bucket, storage_path")
    .eq("order_id", storeOrderUuid);

  if (error) {
    if (!isMissingTableError(error.message)) {
      console.error("[deleteStoreOrder] production_order_assets select:", error.message);
    }
    return;
  }

  const byBucket = new Map<string, string[]>();
  for (const raw of assets ?? []) {
    const row = raw as { storage_bucket?: string | null; storage_path?: string | null };
    const path = (row.storage_path ?? "").trim();
    if (!path) continue;
    const bucket = (row.storage_bucket ?? DEFAULT_PRODUCTION_ASSETS_BUCKET).trim() || DEFAULT_PRODUCTION_ASSETS_BUCKET;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push(path);
  }

  for (const [bucket, objectPaths] of byBucket) {
    const { error: rmErr } = await supabase.storage.from(bucket).remove(objectPaths);
    if (rmErr) {
      console.error("[deleteStoreOrder] production_order_assets storage remove:", bucket, rmErr.message);
    }
  }

  const { error: delErr } = await supabase
    .from(PRODUCTION_ORDER_ASSETS_TABLE)
    .delete()
    .eq("order_id", storeOrderUuid);
  if (delErr && !isMissingTableError(delErr.message)) {
    console.error("[deleteStoreOrder] production_order_assets delete:", delErr.message);
  }
}

export type DeleteStoreOrderResult = DeleteStoreOrderSuccess | { ok: false; error: string };

/**
 * Hard-delete a storefront order and related production / click-up / supplier rows.
 */
export async function deleteStoreOrderById(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orderId: string,
): Promise<DeleteStoreOrderResult> {
  const id = orderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid order." };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("store_orders")
    .select("id, order_number, tracking_token")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, error: "Order not found." };
  }

  const orderNumber = (row.order_number ?? "").trim();

  await deleteProductionOrderAssetsForStoreOrderId(supabase, id);

  if (orderNumber.length > 0) {
    await deleteClickUpSheetImagesForCustomerOrderId(supabase, orderNumber);
  }

  if (orderNumber.length > 0) {
    const { error: supErr } = await supabase
      .from("supplier_order_lines")
      .delete()
      .eq("customer_order_id", orderNumber);
    if (supErr) {
      console.error("[deleteStoreOrder] supplier_order_lines cleanup:", supErr.message);
    }
  }

  const { error: delErr } = await supabase.from("store_orders").delete().eq("id", id);
  if (delErr) {
    return { ok: false, error: delErr.message };
  }

  return { ok: true, trackingToken: (row.tracking_token ?? "").trim() || null };
}

export type DeleteStoreOrderSuccess = { ok: true; trackingToken: string | null };

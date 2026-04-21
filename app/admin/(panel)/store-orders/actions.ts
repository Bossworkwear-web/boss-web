"use server";

import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import { sendStoreOrderShippedEmail } from "@/lib/store-order-email";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type MarkShippedResult = { ok: true } | { ok: false; error: string };

export async function markStoreOrderShipped(orderId: string, trackingNumberRaw: string): Promise<MarkShippedResult> {
  const trackingNumber = trackingNumberRaw.trim();
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { ok: false, error: "Invalid order." };
  }
  if (trackingNumber.length < 6 || trackingNumber.length > 64) {
    return { ok: false, error: "Enter a valid tracking number (6–64 characters)." };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Database not configured." };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("store_orders")
    .select(
      "id, status, customer_email, customer_name, order_number, tracking_token, carrier, tracking_number",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, error: "Order not found." };
  }
  if (row.status === "cancelled") {
    return { ok: false, error: "Order is cancelled." };
  }
  if (row.status === "shipped" && row.tracking_number) {
    return { ok: false, error: "This order is already marked shipped. Edit tracking in Supabase if needed." };
  }

  const shippedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("store_orders")
    .update({
      status: "shipped",
      tracking_number: trackingNumber,
      shipped_at: shippedAt,
    })
    .eq("id", orderId);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  void sendStoreOrderShippedEmail({
    to: row.customer_email,
    customerName: row.customer_name,
    orderNumber: row.order_number,
    trackingToken: row.tracking_token,
    trackingNumber,
    carrier: row.carrier,
  });

  revalidatePath("/admin/store-orders");
  revalidatePath(`/admin/store-orders/${orderId}/docket`);
  revalidatePath(`/orders/track/${row.tracking_token}`);
  return { ok: true };
}

export type MoveStoreOrderToWarehouseResult = { ok: true } | { ok: false; error: string };

export type UpdateInvoiceReferenceResult = { ok: true } | { ok: false; error: string };

const INVOICE_REFERENCE_MAX = 500;

/** Optional note shown on customer tax invoice (phone/email orders). */
export async function updateStoreOrderInvoiceReference(
  orderId: string,
  referenceRaw: string,
): Promise<UpdateInvoiceReferenceResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = orderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid order." };
  }

  const reference = referenceRaw.trim().slice(0, INVOICE_REFERENCE_MAX);
  const value = reference.length > 0 ? reference : null;

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Database not configured." };
  }

  const { error } = await supabase.from("store_orders").update({ invoice_reference: value }).eq("id", id);

  if (error) {
    const msg =
      error.message?.includes("invoice_reference") || error.code === "42703"
        ? `${error.message} — Run Supabase migration: supabase/migrations/20260452_store_orders_invoice_reference.sql then Settings → API → Reload schema.`
        : error.message;
    return { ok: false, error: msg };
  }

  revalidatePath("/admin/store-orders");
  return { ok: true };
}

/**
 * Marks the order shipped with a warehouse handoff timestamp so it appears on
 * Dashboard → Warehouse → Worker → Completed store orders.
 * Does not send customer email (use Mark shipped on Store orders for AusPost + email).
 */
export async function moveStoreOrderToWarehouseCompleted(orderId: string): Promise<MoveStoreOrderToWarehouseResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = orderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid order." };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Database not configured." };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("store_orders")
    .select("id, status, shipped_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, error: "Order not found." };
  }
  if (row.status === "cancelled") {
    return { ok: false, error: "Order is cancelled." };
  }
  if (row.status === "shipped" && row.shipped_at) {
    return { ok: true };
  }

  const shippedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("store_orders")
    .update({
      status: "shipped",
      shipped_at: shippedAt,
    })
    .eq("id", id);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  revalidatePath("/admin/store-orders");
  revalidatePath("/admin/warehouse/worker/store-orders");
  revalidatePath(`/admin/store-orders/${id}/docket`);
  return { ok: true };
}

export type DeleteStoreOrderResult = { ok: true } | { ok: false; error: string };

const CLICK_UP_SHEET_IMAGES_BUCKET = "click-up-sheet-images";
const PRODUCTION_ORDER_ASSETS_TABLE = "production_order_assets";
const DEFAULT_PRODUCTION_ASSETS_BUCKET = "production-order-assets";

function isMissingTableError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("could not find the table") || m.includes("schema cache");
}

/**
 * Click up sheet rows + bucket objects (no FK to store_orders — must clear by order number).
 */
async function deleteClickUpSheetImagesForCustomerOrderId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  customerOrderId: string,
): Promise<void> {
  if (!customerOrderId) {
    return;
  }
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

/**
 * Production pack assets linked by store_orders.id (storage + rows) before deleting the order.
 */
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
    if (!path) {
      continue;
    }
    const bucket = (row.storage_bucket ?? DEFAULT_PRODUCTION_ASSETS_BUCKET).trim() || DEFAULT_PRODUCTION_ASSETS_BUCKET;
    if (!byBucket.has(bucket)) {
      byBucket.set(bucket, []);
    }
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

/**
 * Hard-delete a storefront order.
 * - `store_order_items`: ON DELETE CASCADE from `store_orders`
 * - `supplier_order_lines`: same customer order id (BOS_…)
 * - `click_up_sheet_images`: same customer_order_id text + storage objects
 * - `production_order_assets`: same order_id UUID + storage objects (if table exists)
 */
export async function deleteStoreOrder(orderId: string): Promise<DeleteStoreOrderResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = orderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid order." };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Database not configured." };
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

  revalidatePath("/admin/store-orders");
  revalidatePath("/admin/supplier-orders");
  revalidatePath("/admin/reports");
  revalidatePath("/customer");
  revalidatePath("/admin/warehouse/worker/store-orders");
  revalidatePath("/admin/warehouse/worker/order-mockups");
  if (row.tracking_token) {
    revalidatePath(`/orders/track/${row.tracking_token}`);
  }
  return { ok: true };
}

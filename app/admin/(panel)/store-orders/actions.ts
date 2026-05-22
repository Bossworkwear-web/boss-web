"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import { deleteStoreOrderById, type DeleteStoreOrderResult } from "@/lib/admin-delete-store-order";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type MoveStoreOrderToWarehouseResult = { ok: true } | { ok: false; error: string };

export type UpdateInvoiceReferenceResult = { ok: true } | { ok: false; error: string };

export type ResendInvoiceEmailResult = { ok: true } | { ok: false; error: string };

const INVOICE_REFERENCE_MAX = 500;

/** Optional value shown on customer tax invoice as “Invoice number” (Order ID stays `order_number`). */
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
  revalidatePath("/admin/customer-invoices");
  revalidatePath("/customer");
  /** So admin lists (e.g. Customer Invoices) refetch RSC payload instead of showing stale `invoice_reference`. */
  refresh();
  return { ok: true };
}

/** Admin: resend tax invoice PDF email to the customer (Resend). */
export async function resendStoreOrderInvoiceEmail(orderId: string): Promise<ResendInvoiceEmailResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { resendStoreOrderTaxInvoiceEmail } = await import("@/lib/store-order-invoice-email");
  const res = await resendStoreOrderTaxInvoiceEmail(orderId);
  if (res.ok) {
    revalidatePath("/admin/store-orders");
    revalidatePath("/admin/customer-invoices");
  }
  return res;
}

function sanitizeAdminReturnTo(raw: string): string | null {
  const s = raw.trim();
  if (!s.startsWith("/admin")) return null;
  if (s.includes("://") || s.includes("\n") || s.includes("\r")) return null;
  return s;
}

function appendQueryParam(path: string, param: string): string {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}${param}`;
}

/** Form `action` for `StoreOrderInvoiceReferenceForm` — one stable server action (avoids many inline actions on Customer Invoices). */
export async function submitStoreOrderInvoiceReferenceForm(formData: FormData): Promise<void> {
  const id = String(formData.get("orderId") ?? "").trim();
  const ref = String(formData.get("invoice_reference") ?? "");
  const returnTo = sanitizeAdminReturnTo(String(formData.get("returnTo") ?? ""));

  const res = await updateStoreOrderInvoiceReference(id, ref);

  if (!res.ok) {
    const q = `invoiceError=${encodeURIComponent(res.error.slice(0, 400))}`;
    if (returnTo) {
      redirect(appendQueryParam(returnTo, q));
    }
    redirect(appendQueryParam("/admin/store-orders", q));
  }

  if (returnTo) {
    redirect(appendQueryParam(returnTo, "invoiceSaved=1"));
  }
}

const HOLD_NOTE_MAX = 2000;

/** Admin Store orders list: hold checkbox + optional note. */
export async function updateStoreOrderHoldFields(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    return;
  }

  const id = String(formData.get("orderId") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return;
  }

  const holdRaw = formData.get("hold_process");
  const holdProcess = holdRaw === "1" || holdRaw === "on" || holdRaw === "true";

  const note = String(formData.get("hold_note") ?? "").trim().slice(0, HOLD_NOTE_MAX);
  const holdNote = note.length > 0 ? note : null;

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return;
  }

  const { error } = await supabase
    .from("store_orders")
    .update({ hold_process: holdProcess, hold_note: holdNote })
    .eq("id", id);

  if (error) {
    console.error("[updateStoreOrderHoldFields]", error.message);
    return;
  }

  revalidatePath("/admin/store-orders");
}

/**
 * Marks the order shipped with a warehouse handoff timestamp so it appears on
 * Dashboard → Warehouse → Worker → Completed store orders.
 * Does not send customer email.
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

export type { DeleteStoreOrderResult };

/** Hard-delete a storefront order and related rows (see `lib/admin-delete-store-order.ts`). */
export async function deleteStoreOrder(orderId: string): Promise<DeleteStoreOrderResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Database not configured." };
  }

  const res = await deleteStoreOrderById(supabase, orderId);
  if (!res.ok) {
    return res;
  }

  revalidatePath("/admin/store-orders");
  revalidatePath("/admin/supplier-orders");
  revalidatePath("/admin/reports");
  revalidatePath("/customer");
  revalidatePath("/admin/warehouse/worker/store-orders");
  revalidatePath("/admin/warehouse/worker/order-mockups");
  revalidatePath("/admin/customer-info");
  revalidatePath("/admin/crm");
  if (res.trackingToken) {
    revalidatePath(`/orders/track/${res.trackingToken}`);
  }
  return { ok: true, trackingToken: res.trackingToken };
}

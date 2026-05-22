import { createSupabaseAdminClient } from "@/lib/supabase";
import { connectionHasInvoiceScope, connectionHasPaymentScope } from "@/lib/xero/config";
import { getActiveXeroConnection } from "@/lib/xero/connection-db";
import { recordPaymentForInvoice } from "@/lib/xero/payments";
import { XeroApiError } from "@/lib/xero/api-client";

export type RecordStoreOrderXeroPaymentResult =
  | { ok: true; paymentId: string; alreadyPaid?: boolean }
  | { ok: false; error: string; skipped?: boolean };

export async function recordStoreOrderPaymentInXero(
  storeOrderId: string,
): Promise<RecordStoreOrderXeroPaymentResult> {
  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Database not configured." };
  }

  const { data: order, error: orderErr } = await supabase
    .from("store_orders")
    .select(
      "id, order_number, status, total_cents, created_at, xero_invoice_id, xero_payment_id, stripe_payment_intent_id",
    )
    .eq("id", storeOrderId)
    .maybeSingle();

  if (orderErr || !order) {
    return { ok: false, error: orderErr?.message ?? "Order not found." };
  }

  if (!order.xero_invoice_id) {
    return { ok: false, error: "No Xero invoice on this order.", skipped: true };
  }

  if (order.xero_payment_id) {
    return { ok: true, paymentId: order.xero_payment_id, alreadyPaid: true };
  }

  if (order.status !== "paid" && order.status !== "refunded") {
    return {
      ok: false,
      error: `Order status is ${order.status}; only paid/refunded orders get Xero payments.`,
      skipped: true,
    };
  }

  const connection = await getActiveXeroConnection();
  if (!connection) {
    return { ok: false, error: "Xero is not connected.", skipped: true };
  }

  if (!connectionHasInvoiceScope(connection.scopes)) {
    return {
      ok: false,
      error: "Reconnect Xero with invoice permission (Accounting → Upgrade Xero).",
      skipped: true,
    };
  }

  if (!connectionHasPaymentScope(connection.scopes)) {
    return {
      ok: false,
      error:
        "Xero payment permission missing. Accounting → Upgrade Xero for invoices (adds accounting.payments), then retry.",
      skipped: true,
    };
  }

  const totalCents = Math.max(0, Number(order.total_cents) || 0);
  const amountAud = totalCents / 100;
  if (amountAud <= 0) {
    return { ok: false, error: "Order total is zero.", skipped: true };
  }

  const reference = (order.stripe_payment_intent_id ?? "").trim()
    ? `Stripe ${order.stripe_payment_intent_id}`
    : `BOSS ${order.order_number}`;

  try {
    const { paymentId } = await recordPaymentForInvoice(connection, {
      invoiceId: order.xero_invoice_id,
      amountAud,
      paymentDate: order.created_at ?? new Date().toISOString(),
      reference,
    });

    if (paymentId) {
      await supabase
        .from("store_orders")
        .update({ xero_payment_id: paymentId, xero_payment_error: null })
        .eq("id", storeOrderId);
    }

    return { ok: true, paymentId: paymentId || "", alreadyPaid: !paymentId };
  } catch (e) {
    const msg =
      e instanceof XeroApiError
        ? `Xero API (${e.status}): ${e.message}`
        : e instanceof Error
          ? e.message
          : "Xero payment failed";

    await supabase
      .from("store_orders")
      .update({ xero_payment_error: msg })
      .eq("id", storeOrderId);

    return { ok: false, error: msg };
  }
}

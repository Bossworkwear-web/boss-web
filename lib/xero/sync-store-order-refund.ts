import { createSupabaseAdminClient } from "@/lib/supabase";
import { connectionHasInvoiceScope } from "@/lib/xero/config";
import { createRefundCreditNoteForInvoice } from "@/lib/xero/credit-notes";
import { getActiveXeroConnection } from "@/lib/xero/connection-db";
import { XeroApiError } from "@/lib/xero/api-client";

export type XeroCreditNoteRecord = {
  stripe_refund_id: string;
  credit_note_id: string;
  credit_note_number: string;
  amount_cents: number;
  created_at: string;
};

export type SyncStoreOrderRefundToXeroResult =
  | { ok: true; creditNoteId: string; creditNoteNumber: string; skipped?: boolean }
  | { ok: false; error: string; skipped?: boolean };

function parseCreditNotes(raw: unknown): XeroCreditNoteRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is XeroCreditNoteRecord =>
      r != null &&
      typeof r === "object" &&
      typeof (r as XeroCreditNoteRecord).stripe_refund_id === "string" &&
      typeof (r as XeroCreditNoteRecord).credit_note_id === "string",
  );
}

export async function syncStoreOrderRefundToXero(input: {
  storeOrderId: string;
  stripeRefundId: string;
  amountCents: number;
  refundedAt?: string;
}): Promise<SyncStoreOrderRefundToXeroResult> {
  const stripeRefundId = input.stripeRefundId.trim();
  if (!stripeRefundId) {
    return { ok: false, error: "Missing Stripe refund id." };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Database not configured." };
  }

  const { data: order, error: orderErr } = await supabase
    .from("store_orders")
    .select(
      "id, order_number, xero_invoice_id, xero_contact_id, xero_credit_notes, status",
    )
    .eq("id", input.storeOrderId)
    .maybeSingle();

  if (orderErr || !order) {
    return { ok: false, error: orderErr?.message ?? "Order not found." };
  }

  if (!order.xero_invoice_id || !order.xero_contact_id) {
    return {
      ok: false,
      error: "No Xero invoice on this order; credit note skipped.",
      skipped: true,
    };
  }

  const existing = parseCreditNotes(order.xero_credit_notes);
  const dup = existing.find((r) => r.stripe_refund_id === stripeRefundId);
  if (dup) {
    return {
      ok: true,
      creditNoteId: dup.credit_note_id,
      creditNoteNumber: dup.credit_note_number,
      skipped: true,
    };
  }

  const connection = await getActiveXeroConnection();
  if (!connection) {
    return { ok: false, error: "Xero is not connected.", skipped: true };
  }

  if (!connectionHasInvoiceScope(connection.scopes)) {
    return { ok: false, error: "Xero invoice permission required.", skipped: true };
  }

  const amountCents = Math.max(1, Math.round(input.amountCents));
  const amountAud = amountCents / 100;

  try {
    const { creditNoteId, creditNoteNumber } = await createRefundCreditNoteForInvoice(connection, {
      contactId: order.xero_contact_id,
      invoiceId: order.xero_invoice_id,
      orderNumber: order.order_number,
      refundAmountAud: amountAud,
      refundDate: input.refundedAt ?? new Date().toISOString(),
      stripeRefundId,
    });

    const record: XeroCreditNoteRecord = {
      stripe_refund_id: stripeRefundId,
      credit_note_id: creditNoteId,
      credit_note_number: creditNoteNumber,
      amount_cents: amountCents,
      created_at: new Date().toISOString(),
    };

    await supabase
      .from("store_orders")
      .update({
        xero_credit_notes: [...existing, record],
        xero_refund_sync_error: null,
      })
      .eq("id", input.storeOrderId);

    return { ok: true, creditNoteId, creditNoteNumber };
  } catch (e) {
    const msg =
      e instanceof XeroApiError
        ? `Xero API (${e.status}): ${e.message}`
        : e instanceof Error
          ? e.message
          : "Xero credit note failed";

    await supabase
      .from("store_orders")
      .update({ xero_refund_sync_error: msg })
      .eq("id", input.storeOrderId);

    return { ok: false, error: msg };
  }
}

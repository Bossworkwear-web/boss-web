import { createSupabaseAdminClient } from "@/lib/supabase";
import { connectionHasInvoiceScope } from "@/lib/xero/config";
import {
  findOrCreateXeroContact,
  updateXeroContactName,
  xeroInvoiceContactDisplayName,
} from "@/lib/xero/contacts";
import { getActiveXeroConnection } from "@/lib/xero/connection-db";
import { createAuthorisedSalesInvoice, type XeroInvoiceLineInput } from "@/lib/xero/invoices";
import { recordStoreOrderPaymentInXero } from "@/lib/xero/sync-store-order-payment";
import { XeroApiError, summarizeXeroApiError } from "@/lib/xero/api-client";

export type SyncStoreOrderToXeroResult =
  | {
      ok: true;
      invoiceNumber: string;
      invoiceId: string;
      contactId: string;
      paymentRecorded?: boolean;
      paymentAlreadyPaid?: boolean;
    }
  | { ok: false; error: string; skipped?: boolean };

function centsToAudInclGst(cents: number): number {
  return Math.round(cents) / 100;
}

function buildLineDescription(input: {
  productName: string;
  serviceType: string | null;
  color: string | null;
  size: string | null;
}): string {
  const parts = [input.productName.trim() || "Product"];
  const extras = [input.serviceType, input.color, input.size].map((s) => (s ?? "").trim()).filter(Boolean);
  if (extras.length) {
    parts.push(`(${extras.join(", ")})`);
  }
  return parts.join(" ");
}

async function lookupOrganisationByEmail(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  emailRaw: string,
): Promise<string> {
  const email = emailRaw.trim();
  if (!email) return "";
  const emailLower = email.toLowerCase();
  const { data: eq } = await supabase
    .from("customer_profiles")
    .select("organisation")
    .eq("email_address", emailLower)
    .maybeSingle();
  if (eq?.organisation?.trim()) return eq.organisation.trim();
  const { data: orig } = await supabase
    .from("customer_profiles")
    .select("organisation")
    .eq("email_address", email)
    .maybeSingle();
  if (orig?.organisation?.trim()) return orig.organisation.trim();
  const { data: ilike } = await supabase
    .from("customer_profiles")
    .select("organisation")
    .ilike("email_address", email)
    .maybeSingle();
  return ilike?.organisation?.trim() ?? "";
}

async function resolveInvoiceContactName(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  order: { customer_email: string; customer_name: string },
): Promise<string> {
  const organisation = await lookupOrganisationByEmail(supabase, order.customer_email);
  return xeroInvoiceContactDisplayName({
    organisation,
    customerName: order.customer_name,
    email: order.customer_email,
  });
}

/** Best-effort: rename the Xero contact on an already-synced order to Company Name. */
export async function refreshSyncedOrderXeroContactName(storeOrderId: string): Promise<{
  ok: boolean;
  error?: string;
  contactName?: string;
}> {
  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Database not configured." };
  }

  const { data: order, error } = await supabase
    .from("store_orders")
    .select("customer_email, customer_name, xero_contact_id, xero_invoice_id")
    .eq("id", storeOrderId)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, error: error?.message ?? "Order not found." };
  }
  if (!order.xero_invoice_id || !order.xero_contact_id) {
    return { ok: false, error: "Order has no Xero invoice/contact yet." };
  }

  const connection = await getActiveXeroConnection();
  if (!connection) {
    return { ok: false, error: "Xero is not connected." };
  }
  if (!connectionHasInvoiceScope(connection.scopes)) {
    return { ok: false, error: "Xero invoice permission missing." };
  }

  const contactName = await resolveInvoiceContactName(supabase, order);
  try {
    await updateXeroContactName(connection, order.xero_contact_id, contactName);
    return { ok: true, contactName };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update Xero contact name." };
  }
}

export async function syncStoreOrderToXero(storeOrderId: string): Promise<SyncStoreOrderToXeroResult> {
  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Database not configured." };
  }

  const { data: order, error: orderErr } = await supabase
    .from("store_orders")
    .select(
      "id, order_number, status, customer_email, customer_name, subtotal_cents, total_cents, delivery_fee_cents, promotion_discount_cents, currency, created_at, xero_sync_status, xero_invoice_id, xero_invoice_number, xero_contact_id, xero_payment_id",
    )
    .eq("id", storeOrderId)
    .maybeSingle();

  if (orderErr || !order) {
    return { ok: false, error: orderErr?.message ?? "Order not found." };
  }

  if (order.xero_invoice_id) {
    await refreshSyncedOrderXeroContactName(storeOrderId);
    const payRes = await recordStoreOrderPaymentInXero(storeOrderId);
    if (!payRes.ok) {
      return { ok: false, error: payRes.error, skipped: payRes.skipped };
    }
    return {
      ok: true,
      invoiceNumber: (order.xero_invoice_number ?? "").trim() || "—",
      invoiceId: order.xero_invoice_id,
      contactId: (order.xero_contact_id ?? "").trim(),
      paymentRecorded: Boolean(payRes.paymentId),
      paymentAlreadyPaid: payRes.alreadyPaid,
    };
  }

  if (order.status !== "paid") {
    return { ok: false, error: `Order status is ${order.status}; only paid orders sync.`, skipped: true };
  }

  const connection = await getActiveXeroConnection();
  if (!connection) {
    await markXeroSync(supabase, storeOrderId, {
      status: "skipped",
      error: "Xero is not connected.",
    });
    return { ok: false, error: "Xero is not connected.", skipped: true };
  }

  if (!connectionHasInvoiceScope(connection.scopes)) {
    const msg = "Reconnect Xero with invoice permission (Accounting → Upgrade Xero for invoices).";
    await markXeroSync(supabase, storeOrderId, { status: "skipped", error: msg });
    return { ok: false, error: msg, skipped: true };
  }

  const { data: items, error: itemsErr } = await supabase
    .from("store_order_items")
    .select("product_name, quantity, unit_price_cents, line_total_cents, service_type, color, size")
    .eq("order_id", storeOrderId)
    .order("sort_order", { ascending: true });

  if (itemsErr) {
    return { ok: false, error: itemsErr.message };
  }

  const lineItems: XeroInvoiceLineInput[] = (items ?? []).map((row) => {
    const qty = Math.max(1, Math.floor(Number(row.quantity) || 1));
    const lineCents = Math.max(0, Number(row.line_total_cents) || 0);
    const unitCents =
      Number(row.unit_price_cents) > 0
        ? Number(row.unit_price_cents)
        : qty > 0
          ? Math.round(lineCents / qty)
          : 0;
    return {
      description: buildLineDescription({
        productName: String(row.product_name ?? ""),
        serviceType: row.service_type,
        color: row.color,
        size: row.size,
      }),
      quantity: qty,
      unitAmountInclGst: centsToAudInclGst(unitCents),
    };
  });

  const deliveryCents = Math.max(0, Number(order.delivery_fee_cents) || 0);
  if (deliveryCents > 0) {
    lineItems.push({
      description: "Delivery",
      quantity: 1,
      unitAmountInclGst: centsToAudInclGst(deliveryCents),
    });
  }

  const promoCents = Math.max(0, Number(order.promotion_discount_cents) || 0);

  // The one-off embroidery logo setup fee is baked into the order total but not stored as its own column,
  // so derive it: total = products + delivery + logoSetup − promo. Without this line the invoice total can
  // go negative (e.g. a $66 "free setup" promo offsetting a fee that was never on the invoice), which Xero
  // rejects with "The Total for this document must be greater than or equal to zero."
  const subtotalCents = Math.max(0, Number(order.subtotal_cents) || 0);
  const orderTotalCents = Math.max(0, Number(order.total_cents) || 0);
  const logoSetupCents = Math.max(0, orderTotalCents + promoCents - subtotalCents - deliveryCents);
  if (logoSetupCents > 0) {
    lineItems.push({
      description: "Logo setup (one-off)",
      quantity: 1,
      unitAmountInclGst: centsToAudInclGst(logoSetupCents),
    });
  }

  if (promoCents > 0) {
    lineItems.push({
      description: "Promotion discount",
      quantity: 1,
      unitAmountInclGst: -centsToAudInclGst(promoCents),
    });
  }

  try {
    const contactName = await resolveInvoiceContactName(supabase, order);
    const contactId = await findOrCreateXeroContact(connection, {
      name: contactName,
      email: order.customer_email,
    });

    const { invoiceId, invoiceNumber } = await createAuthorisedSalesInvoice(connection, {
      contactId,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      lineItems,
    });

    await markXeroSync(supabase, storeOrderId, {
      status: "synced",
      contactId,
      invoiceId,
      invoiceNumber,
      error: null,
    });

    const payRes = await recordStoreOrderPaymentInXero(storeOrderId);

    return {
      ok: true,
      invoiceNumber,
      invoiceId,
      contactId,
      paymentRecorded: payRes.ok && Boolean(payRes.paymentId),
      paymentAlreadyPaid: payRes.ok ? payRes.alreadyPaid : undefined,
    };
  } catch (e) {
    const msg =
      e instanceof XeroApiError
        ? summarizeXeroApiError(e)
        : e instanceof Error
          ? e.message
          : "Xero sync failed";
    await markXeroSync(supabase, storeOrderId, { status: "failed", error: msg });
    return { ok: false, error: msg };
  }
}

async function markXeroSync(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orderId: string,
  input: {
    status: "pending" | "synced" | "failed" | "skipped";
    contactId?: string;
    invoiceId?: string;
    invoiceNumber?: string;
    error?: string | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    xero_sync_status: input.status,
    xero_sync_error: input.error ?? null,
    xero_synced_at: input.status === "synced" ? new Date().toISOString() : null,
  };
  if (input.contactId) patch.xero_contact_id = input.contactId;
  if (input.invoiceId) patch.xero_invoice_id = input.invoiceId;
  if (input.invoiceNumber) {
    patch.xero_invoice_number = input.invoiceNumber;
    patch.invoice_reference = input.invoiceNumber;
  }

  await supabase.from("store_orders").update(patch).eq("id", orderId);
}

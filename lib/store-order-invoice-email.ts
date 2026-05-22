import { formatMoneyFromCents, siteBaseUrl } from "@/lib/store-order-utils";
import { buildStoreTaxInvoicePdfForOrderId } from "@/lib/store-tax-invoice-for-order";
import { createSupabaseAdminClient } from "@/lib/supabase";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ResendStoreOrderInvoiceEmailResult = { ok: true } | { ok: false; error: string };

/** Admin: resend tax invoice PDF email only (Resend). Requires invoice_reference on the order. */
export async function resendStoreOrderTaxInvoiceEmail(orderId: string): Promise<ResendStoreOrderInvoiceEmailResult> {
  try {
    return await resendStoreOrderTaxInvoiceEmailInner(orderId);
  } catch (e) {
    console.error("[resendStoreOrderTaxInvoiceEmail]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error sending invoice email." };
  }
}

async function resendStoreOrderTaxInvoiceEmailInner(
  orderId: string,
): Promise<ResendStoreOrderInvoiceEmailResult> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId.trim())) {
    return { ok: false, error: "Invalid order." };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Database not configured." };
  }

  const orderSelect =
    "id, order_number, tracking_token, customer_email, customer_name, total_cents, currency, invoice_reference";

  const { data: order, error: orderErr } = await supabase
    .from("store_orders")
    .select(orderSelect)
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return { ok: false, error: orderErr?.message ?? "Order not found." };
  }

  let xeroInvoiceNumber: string | null = null;
  const xeroNumRes = await supabase.from("store_orders").select("xero_invoice_number").eq("id", orderId).maybeSingle();
  if (!xeroNumRes.error && xeroNumRes.data) {
    const v = (xeroNumRes.data as { xero_invoice_number?: string | null }).xero_invoice_number;
    xeroInvoiceNumber = v == null ? null : String(v).trim() || null;
  }

  const invoiceNumber = (xeroInvoiceNumber ?? order.invoice_reference ?? "").trim();
  if (!invoiceNumber) {
    return {
      ok: false,
      error: "No invoice number on this order. Sync to Xero or enter an invoice number first.",
    };
  }

  const to = (order.customer_email ?? "").trim();
  if (!to) {
    return { ok: false, error: "Order has no customer email." };
  }

  const pdfRes = await buildStoreTaxInvoicePdfForOrderId(order.id);
  if (!pdfRes.ok) {
    return { ok: false, error: pdfRes.error };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL ?? "Boss Web <onboarding@resend.dev>";
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set on the server." };
  }

  const customerName = (order.customer_name ?? "").trim() || "Customer";
  const orderNumber = order.order_number;
  const totalFormatted = formatMoneyFromCents(order.total_cents, order.currency);
  const trackUrl = `${siteBaseUrl()}/orders/track/${order.tracking_token}`;

  const subject = `Tax invoice ${invoiceNumber} — ${orderNumber}`;
  const html = `
    <p>Hi ${escapeHtml(customerName)},</p>
    <p>Please find your tax invoice attached for order <strong>${escapeHtml(orderNumber)}</strong>.</p>
    <p>Invoice number: <strong>${escapeHtml(invoiceNumber)}</strong></p>
    <p>Order total: <strong>${escapeHtml(totalFormatted)}</strong></p>
    <p><a href="${escapeHtml(trackUrl)}">View order status</a></p>
  `
    .replace(/\n\s+/g, " ")
    .trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        attachments: [
          {
            filename: pdfRes.filename,
            content: pdfRes.buffer.toString("base64"),
          },
        ],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      return { ok: false, error: json?.message ?? res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email failed." };
  }
}

import { resendFromAccount } from "@/lib/resend-from";
import { australiaPostTrackingUrl, siteBaseUrl } from "@/lib/store-order-utils";
import { getEmailTemplateContent, renderEmailTemplate } from "@/lib/store-email-templates";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeEmailHtml(html: string): string {
  return html.replace(/\n\s+/g, " ").trim();
}

export async function sendStoreOrderConfirmationEmail(args: {
  to: string;
  customerName: string;
  orderNumber: string;
  trackingToken: string;
  totalFormatted: string;
  /** Xero tax invoice number when phase 2 sync succeeded. */
  xeroInvoiceNumber?: string;
  /** Tax invoice PDF attachment (base64 content for Resend). */
  taxInvoicePdf?: { filename: string; base64: string };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resendFromAccount();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const trackUrl = `${siteBaseUrl()}/orders/track/${args.trackingToken}`;
  const invoiceNo = (args.xeroInvoiceNumber ?? "").trim();
  const invoiceLine = invoiceNo
    ? `<p>Tax invoice number: <strong>${escapeHtml(invoiceNo)}</strong>${args.taxInvoicePdf ? " — PDF attached." : ""}</p>`
    : "";
  const invoiceSubjectSuffix = invoiceNo ? ` (Invoice ${invoiceNo})` : "";

  const template = await getEmailTemplateContent("order_confirmation");
  const vars = {
    customerName: escapeHtml(args.customerName),
    orderNumber: escapeHtml(args.orderNumber),
    totalFormatted: escapeHtml(args.totalFormatted),
    trackUrl: escapeHtml(trackUrl),
    invoiceLine,
    invoiceSubjectSuffix: escapeHtml(invoiceSubjectSuffix),
  };
  const subject = renderEmailTemplate(template.subject, vars);
  const html = normalizeEmailHtml(renderEmailTemplate(template.html, vars));

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject,
        html,
        ...(args.taxInvoicePdf
          ? {
              attachments: [
                {
                  filename: args.taxInvoicePdf.filename,
                  content: args.taxInvoicePdf.base64,
                },
              ],
            }
          : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      return { ok: false, error: json?.message ?? res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email failed" };
  }
}

export async function sendStoreOrderShippedEmail(args: {
  to: string;
  customerName: string;
  orderNumber: string;
  trackingToken: string;
  trackingNumber: string;
  carrier: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resendFromAccount();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const trackUrl = `${siteBaseUrl()}/orders/track/${args.trackingToken}`;
  const carrierLower = args.carrier.toLowerCase();
  const apUrl =
    carrierLower.includes("australia post") || carrierLower.includes("auspost")
      ? australiaPostTrackingUrl(args.trackingNumber)
      : null;

  const carrierTrackHtml = apUrl
    ? `<p><a href="${escapeHtml(apUrl)}">Track on Australia Post</a></p>`
    : `<p>Use your carrier’s website with the tracking number above.</p>`;

  const template = await getEmailTemplateContent("order_shipped");
  const vars = {
    customerName: escapeHtml(args.customerName),
    orderNumber: escapeHtml(args.orderNumber),
    trackUrl: escapeHtml(trackUrl),
    carrier: escapeHtml(args.carrier),
    trackingNumber: escapeHtml(args.trackingNumber),
    carrierTrackHtml,
  };
  const subject = renderEmailTemplate(template.subject, vars);
  const html = normalizeEmailHtml(renderEmailTemplate(template.html, vars));

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject,
        html,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      return { ok: false, error: json?.message ?? res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email failed" };
  }
}

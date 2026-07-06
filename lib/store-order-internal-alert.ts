import { resendFromAccount } from "@/lib/resend-from";
import { siteBaseUrl } from "@/lib/store-order-utils";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Default inbox for paid online order staff alerts. */
export const ONLINE_ORDER_ALERT_EMAIL_DEFAULT = "sales@bossworkwear.au";

/** Who receives new online order alerts. Override with `ONLINE_ORDER_ALERT_EMAIL` in env. */
function alertRecipient(): string {
  return process.env.ONLINE_ORDER_ALERT_EMAIL?.trim() || ONLINE_ORDER_ALERT_EMAIL_DEFAULT;
}

/**
 * Best-effort staff alert when a customer completes a paid online order.
 * Never throws — a failed alert must not block checkout.
 */
export async function sendOnlineOrderInternalAlert(args: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  deliveryAddress: string;
  totalFormatted: string;
  lineCount: number;
  lineSummary: string;
}): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false };
  }

  const to = alertRecipient();
  const from = resendFromAccount();
  const adminUrl = `${siteBaseUrl()}/admin/online-orders`;
  const subject = `[Boss Workwear] New online order ${args.orderNumber}`;
  const html = `
    <p>A customer has placed a new <strong>online order</strong> on the website.</p>
    <ul>
      <li><strong>Order:</strong> ${escapeHtml(args.orderNumber)}</li>
      <li><strong>Total:</strong> ${escapeHtml(args.totalFormatted)} (inc GST)</li>
      <li><strong>Customer:</strong> ${escapeHtml(args.customerName)}</li>
      <li><strong>Email:</strong> ${escapeHtml(args.customerEmail)}</li>
      <li><strong>Delivery:</strong> ${escapeHtml(args.deliveryAddress)}</li>
      <li><strong>Lines:</strong> ${args.lineCount} (${escapeHtml(args.lineSummary)})</li>
    </ul>
    <p><a href="${escapeHtml(adminUrl)}">Open Admin → Online orders</a></p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

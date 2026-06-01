import { resendFromAccount } from "@/lib/resend-from";
import { siteBaseUrl } from "@/lib/store-order-utils";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Who receives Xero failure alerts. Falls back to the CRM internal inbox, then the account address. */
function alertRecipient(): string {
  return (
    process.env.XERO_ALERT_EMAIL?.trim() ||
    process.env.CRM_INTERNAL_NOTIFY_EMAIL?.trim() ||
    "account@bossworkwear.au"
  );
}

/**
 * Best-effort internal alert when a paid order failed to create its Xero invoice, so staff can fix the
 * connection and resync without the customer ever being blocked. Never throws.
 */
export async function sendXeroSyncFailureAlert(args: {
  orderNumber: string;
  error: string;
}): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false };
  }

  const to = alertRecipient();
  const from = resendFromAccount();
  const accountingUrl = `${siteBaseUrl()}/admin/accounting`;
  const subject = `[Boss Workwear] Xero invoice NOT created for ${args.orderNumber}`;
  const html = `
    <p>A paid order could not be pushed to Xero automatically.</p>
    <p><strong>Order:</strong> ${escapeHtml(args.orderNumber)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(args.error)}</p>
    <p>The customer was not affected — their order and tax invoice download work normally.
    Fix the Xero connection, then use <strong>Resync</strong> on the Accounting page to push any missed orders.</p>
    <p><a href="${escapeHtml(accountingUrl)}">Open Admin → Accounting</a></p>
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

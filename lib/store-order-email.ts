import { australiaPostTrackingUrl, siteBaseUrl } from "@/lib/store-order-utils";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendStoreOrderConfirmationEmail(args: {
  to: string;
  customerName: string;
  orderNumber: string;
  trackingToken: string;
  totalFormatted: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "Boss Web <onboarding@resend.dev>";
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const trackUrl = `${siteBaseUrl()}/orders/track/${args.trackingToken}`;
  const subject = `Order confirmed — ${args.orderNumber}`;
  const html = `
    <p>Hi ${escapeHtml(args.customerName)},</p>
    <p>Your customer order ID is <strong>${escapeHtml(args.orderNumber)}</strong> — keep it for invoices and support.</p>
    <p>Total: <strong>${escapeHtml(args.totalFormatted)}</strong></p>
    <p>You can check status and tracking any time:</p>
    <p><a href="${escapeHtml(trackUrl)}">View order &amp; delivery tracking</a></p>
    <p>If the link does not work, copy this URL:<br/><code>${escapeHtml(trackUrl)}</code></p>
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

export async function sendStoreOrderShippedEmail(args: {
  to: string;
  customerName: string;
  orderNumber: string;
  trackingToken: string;
  trackingNumber: string;
  carrier: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "Boss Web <onboarding@resend.dev>";
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const trackUrl = `${siteBaseUrl()}/orders/track/${args.trackingToken}`;
  const carrierLower = args.carrier.toLowerCase();
  const apUrl =
    carrierLower.includes("australia post") || carrierLower.includes("auspost")
      ? australiaPostTrackingUrl(args.trackingNumber)
      : null;

  const subject = `Shipped — ${args.orderNumber}`;
  const html = `
    <p>Hi ${escapeHtml(args.customerName)},</p>
    <p>Your order <strong>${escapeHtml(args.orderNumber)}</strong> has been dispatched.</p>
    <p><strong>${escapeHtml(args.carrier)}</strong> tracking: <code>${escapeHtml(args.trackingNumber)}</code></p>
    ${
      apUrl
        ? `<p><a href="${escapeHtml(apUrl)}">Track on Australia Post</a></p>`
        : `<p>Use your carrier’s website with the tracking number above.</p>`
    }
    <p>Order summary &amp; status: <a href="${escapeHtml(trackUrl)}">${escapeHtml(trackUrl)}</a></p>
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

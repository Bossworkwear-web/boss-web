import { resendFromAccount } from "@/lib/resend-from";
import {
  STOREFRONT_PHONE_DISPLAY,
  STOREFRONT_QUOTE_EMAIL_RECIPIENT,
} from "@/lib/storefront-quote-mailto";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SendOrderProofEmailArgs = {
  to: string;
  contactName: string;
  orderNumber: string;
  round: number;
  imageUrls: string[];
  note: string | null;
  approveUrl: string;
};

export type SendOrderProofEmailResult =
  | { ok: true }
  | { ok: false; error: string; skipped?: boolean };

/** Customer-facing: embroidery/print proof (시안) for approval, with a no-login approve link (Resend). */
export async function sendOrderProofEmail(
  args: SendOrderProofEmailArgs,
): Promise<SendOrderProofEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set", skipped: true };
  }

  const to = args.to.trim();
  if (!to) {
    return { ok: false, error: "No customer email on this order." };
  }

  const contact = args.contactName.trim() || "there";
  const roundSuffix = args.round > 1 ? ` (revision ${args.round})` : "";
  const subject = `Your design proof for order ${args.orderNumber}${roundSuffix}`;

  const imagesHtml = args.imageUrls
    .map(
      (url) =>
        `<a href="${escapeHtml(url)}" style="display:block;margin:8px 0"><img src="${escapeHtml(
          url,
        )}" alt="Design proof" style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px" /></a>`,
    )
    .join("");

  const noteHtml = args.note?.trim()
    ? `<p style="margin:12px 0;color:#334155">${escapeHtml(args.note.trim()).replace(/\n/g, "<br/>")}</p>`
    : "";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
      <p>Hi ${escapeHtml(contact)},</p>
      <p>Please review the design proof for your order <strong>${escapeHtml(args.orderNumber)}</strong>${escapeHtml(
        roundSuffix,
      )}. Production will begin once you approve.</p>
      ${noteHtml}
      ${imagesHtml}
      <p style="margin:24px 0">
        <a href="${escapeHtml(args.approveUrl)}"
           style="background:#f97316;color:#0f172a;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:10px;display:inline-block">
          Review &amp; approve your proof
        </a>
      </p>
      <p style="font-size:13px;color:#64748b">
        If the button does not work, copy this link into your browser:<br/>
        <span style="word-break:break-all">${escapeHtml(args.approveUrl)}</span>
      </p>
      <p style="font-size:13px;color:#64748b;margin-top:24px">
        Questions? Reply to this email or call ${escapeHtml(STOREFRONT_PHONE_DISPLAY)}.<br/>
        ${escapeHtml(STOREFRONT_QUOTE_EMAIL_RECIPIENT)}
      </p>
    </div>
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
        from: resendFromAccount(),
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: json?.message ?? res.statusText };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email send failed";
    return { ok: false, error: msg };
  }
}

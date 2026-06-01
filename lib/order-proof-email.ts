import { resendFromSales } from "@/lib/resend-from";
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
  /** Leading `imageUrls` that are logo artwork (shown large, one per row) vs. mock-ups (3-up grid). */
  logoCount?: number;
  note: string | null;
  approveUrl: string;
};

/** Table-based 3-up grid of proof images at half size (email-client safe). */
function proofImageGridHtml(urls: string[]): string {
  if (urls.length === 0) return "";
  const COLS = 3;
  const rows: string[][] = [];
  for (let i = 0; i < urls.length; i += COLS) {
    rows.push(urls.slice(i, i + COLS));
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:16px 0">${rows
    .map((row) => {
      const cells = row
        .map(
          (url) =>
            `<td width="33.33%" valign="top" align="center" style="padding:6px"><a href="${escapeHtml(
              url,
            )}" style="display:block;text-decoration:none"><img src="${escapeHtml(
              url,
            )}" alt="Design proof" width="320" style="width:100%;max-width:320px;height:auto;border:1px solid #e2e8f0;border-radius:8px" /></a></td>`,
        )
        .join("");
      const fillers = Array.from({ length: COLS - row.length })
        .map(() => `<td width="33.33%" style="padding:6px"></td>`)
        .join("");
      return `<tr>${cells}${fillers}</tr>`;
    })
    .join("")}</table>`;
}

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

  // Logo artwork (the leading entries) is shown large, one per row; the mock-ups that follow are
  // gridded 3-per-row at half size for a clean, professional layout.
  const logoCount = Math.max(0, Math.min(args.imageUrls.length, args.logoCount ?? 0));
  const logoUrls = args.imageUrls.slice(0, logoCount);
  const mockupUrls = args.imageUrls.slice(logoCount);

  const logosHtml = logoUrls
    .map(
      (url) =>
        `<a href="${escapeHtml(url)}" style="display:block;margin:12px 0;text-align:center"><img src="${escapeHtml(
          url,
        )}" alt="Logo artwork" style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px" /></a>`,
    )
    .join("");

  const imagesHtml = `${logosHtml}${proofImageGridHtml(mockupUrls)}`;

  const noteHtml = args.note?.trim()
    ? `<p style="margin:12px 0;color:#334155">${escapeHtml(args.note.trim()).replace(/\n/g, "<br/>")}</p>`
    : "";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:1280px;margin:0 auto;color:#0f172a">
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
        from: resendFromSales(),
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

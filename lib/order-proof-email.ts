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

export type ProofImageCaption = { method: string; memo: string };

export type ProofMockupItem = { url: string; caption?: ProofImageCaption };

export type SendOrderProofEmailArgs = {
  to: string;
  contactName: string;
  orderNumber: string;
  round: number;
  /** Customer's saved master logo — always shown at the top when available. */
  masterLogoUrl?: string | null;
  /** Click-up mock-ups, shown under "Logo Location, Colour & Size" (3-up grid with method + MEMO). */
  mockups: ProofMockupItem[];
  /** Drag-and-dropped artwork, shown under "Embroidery Preview" (large, one per row). */
  embroideryPreviews: string[];
  note: string | null;
  approveUrl: string;
};

type ProofGridItem = ProofMockupItem;

/** Section heading used between proof image groups. */
function sectionTitleHtml(text: string): string {
  return `<h2 style="margin:26px 0 8px;font-size:16px;font-weight:bold;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:6px">${escapeHtml(
    text,
  )}</h2>`;
}

/** One large image, centered (master logo / embroidery preview). */
function largeImageHtml(url: string, alt: string): string {
  return `<a href="${escapeHtml(url)}" style="display:block;margin:12px 0;text-align:center"><img src="${escapeHtml(
    url,
  )}" alt="${escapeHtml(alt)}" style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px" /></a>`;
}

/** Caption block (decorate method + MEMO) shown under a mock-up image. */
function captionHtml(caption: ProofImageCaption | undefined): string {
  if (!caption) return "";
  const method = caption.method?.trim();
  const memo = caption.memo?.trim();
  if (!method && !memo) return "";
  const methodHtml = method
    ? `<div style="margin-top:6px;font-weight:bold;color:#1e3a8a;font-size:13px">${escapeHtml(method)}</div>`
    : "";
  const memoHtml = memo
    ? `<div style="margin-top:3px;color:#475569;font-size:12px;line-height:1.45;text-align:left">${escapeHtml(
        memo,
      ).replace(/\n/g, "<br/>")}</div>`
    : "";
  return `<div style="max-width:320px;margin:0 auto">${methodHtml}${memoHtml}</div>`;
}

/** Table-based 3-up grid of proof images at half size (email-client safe), with captions underneath. */
function proofImageGridHtml(items: ProofGridItem[]): string {
  if (items.length === 0) return "";
  const COLS = 3;
  const rows: ProofGridItem[][] = [];
  for (let i = 0; i < items.length; i += COLS) {
    rows.push(items.slice(i, i + COLS));
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:16px 0">${rows
    .map((row) => {
      const cells = row
        .map(
          (item) =>
            `<td width="33.33%" valign="top" align="center" style="padding:6px"><a href="${escapeHtml(
              item.url,
            )}" style="display:block;text-decoration:none"><img src="${escapeHtml(
              item.url,
            )}" alt="Design proof" width="320" style="width:100%;max-width:320px;height:auto;border:1px solid #e2e8f0;border-radius:8px" /></a>${captionHtml(
              item.caption,
            )}</td>`,
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

  // Sections, in order: Master logo (always when available) → "Logo Location, Colour & Size" (Click-up
  // mock-ups) → "Embroidery Preview" (drag-and-dropped artwork).
  const masterLogoUrl = (args.masterLogoUrl ?? "").trim();
  const masterSection = masterLogoUrl
    ? `${sectionTitleHtml("Master logo")}${largeImageHtml(masterLogoUrl, "Master logo")}`
    : "";

  const mockupSection = args.mockups.length
    ? `${sectionTitleHtml("Logo Location, Colour & Size")}${proofImageGridHtml(args.mockups)}`
    : "";

  const previewSection = args.embroideryPreviews.length
    ? `${sectionTitleHtml("Embroidery Preview")}${args.embroideryPreviews
        .map((url) => largeImageHtml(url, "Embroidery preview"))
        .join("")}`
    : "";

  const imagesHtml = `${masterSection}${mockupSection}${previewSection}`;

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
      <p style="margin:20px 0 8px;color:#334155">
        Happy with the design? Click the button below to approve.
        <strong>Need changes to the logo or mock-up?</strong> Just reply to this email with what you'd like
        adjusted and we'll send you a revised proof.
      </p>
      <p style="margin:8px 0 24px">
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

import type { CustomerQuoteRecord } from "@/lib/customer-quote";
import { resendFromSales } from "@/lib/resend-from";
import { formatMoneyFromCents } from "@/lib/store-order-utils";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lineDescriptor(line: CustomerQuoteRecord["lines"][number]): string {
  const bits = [line.serviceType, line.color, line.size].map((s) => String(s ?? "").trim()).filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : "";
}

/** Email the customer a copy of their cart quote (Resend). Returns ok/skip/error. */
export async function sendCustomerCartQuoteEmail(
  quote: CustomerQuoteRecord,
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Email is not configured (RESEND_API_KEY).", skipped: true };
  }

  const to = quote.customerEmail.trim();
  if (!to) {
    return { ok: false, error: "Customer email is missing." };
  }

  const currency = quote.currency || "AUD";
  const greeting = quote.customerName?.trim() ? `Hi ${quote.customerName.trim()},` : "Hi,";

  const rows = quote.lines
    .map((line) => {
      const desc = lineDescriptor(line);
      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">
            <div style="font-weight:600;color:#0f172a">${escapeHtml(line.productName)}</div>
            ${desc ? `<div style="font-size:12px;color:#64748b">${escapeHtml(desc)}</div>` : ""}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#0f172a">${line.quantity}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0f172a">${escapeHtml(
            formatMoneyFromCents(Math.round(line.totalPrice * 100), currency),
          )}</td>
        </tr>`;
    })
    .join("");

  function summaryRow(label: string, cents: number, opts?: { strong?: boolean; negative?: boolean }) {
    const amount = `${opts?.negative ? "−" : ""}${formatMoneyFromCents(cents, currency)}`;
    const weight = opts?.strong ? "font-weight:700;font-size:16px" : "";
    return `
      <tr>
        <td style="padding:4px 10px;text-align:right;color:#334155;${weight}">${escapeHtml(label)}</td>
        <td style="padding:4px 10px;text-align:right;color:#0f172a;${weight}">${escapeHtml(amount)}</td>
      </tr>`;
  }

  const summary = [
    summaryRow("Product subtotal", quote.productGrossCents),
    quote.volumeDiscountCents > 0 ? summaryRow("Volume discount", quote.volumeDiscountCents, { negative: true }) : "",
    quote.logoSetupCents > 0 ? summaryRow("Logo setup fee", quote.logoSetupCents) : "",
    quote.pickup ? summaryRow("Delivery", 0) : summaryRow("Delivery fee", quote.deliveryCents),
    summaryRow("Total (GST incl.)", quote.totalCents, { strong: true }),
  ].join("");

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;max-width:640px">
      <p>${escapeHtml(greeting)}</p>
      <p>Here is your saved quote <strong>${escapeHtml(quote.quoteNumber)}</strong>. You can reorder it any time from
      <em>My account → My Quote</em>.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <thead>
          <tr style="background:#0f172a;color:#fff">
            <th style="padding:8px 10px;text-align:left;font-size:12px;letter-spacing:.05em">PRODUCT</th>
            <th style="padding:8px 10px;text-align:center;font-size:12px;letter-spacing:.05em">QTY</th>
            <th style="padding:8px 10px;text-align:right;font-size:12px;letter-spacing:.05em">LINE TOTAL</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:8px">${summary}</table>
      <p style="font-size:12px;color:#64748b;margin-top:16px">
        ${quote.pickup ? "Warehouse pick-up selected." : "Delivery is estimated from your saved address and may be re-confirmed at checkout."}
        Prices include GST. Quotes are an estimate and may change before payment.
      </p>
    </div>`;

  const subject = `Your quote ${quote.quoteNumber} — Boss Workwear`;

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
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}

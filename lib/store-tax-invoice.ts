import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { STOREFRONT_PHONE_DISPLAY, STOREFRONT_QUOTE_EMAIL_RECIPIENT } from "@/lib/storefront-quote-mailto";
import { taxInvoiceLogoHtmlSrc } from "@/lib/tax-invoice-logo";

export type TaxInvoiceSeller = {
  legalName: string;
  abn: string;
  addressLines: string;
  /** Optional — shown on PDF (M / E / W) and payment footer */
  phone?: string;
  email?: string;
  website?: string;
  bsb?: string;
  accountNo?: string;
  accountName?: string;
  bankName?: string;
  /** Shown above bank details (e.g. direct deposit instruction). */
  paymentNote?: string;
  /** Days after invoice date for “Due date” (default 14). */
  dueDaysAfterInvoice?: number;
};

export type TaxInvoiceOrder = {
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  delivery_address: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  currency: string;
  /** Optional Xero / manual id — shown on PDF as “Invoice number” (see `TAX_INVOICE_PENDING_INVOICE_NUMBER_NOTE`). */
  invoice_reference?: string | null;
  /** From `customer_profiles.organisation` when generating the invoice (non-empty → BILL TO). */
  customer_organisation?: string | null;
};

/** BILL TO: company name if set, otherwise customer name. */
export function billToDisplayName(order: TaxInvoiceOrder): string {
  const org = String(order.customer_organisation ?? "").trim();
  if (org) return org;
  const name = String(order.customer_name ?? "").trim();
  return name || "—";
}

/** Payment note + bank lines for PDF/HTML footer (empty if nothing configured). */
export function sellerBankBlockLines(seller: TaxInvoiceSeller): string[] {
  const note = (seller.paymentNote ?? "").trim();
  const hasBank = Boolean(seller.bsb || seller.accountNo || seller.accountName || seller.bankName);
  if (!note && !hasBank) return [];
  const lines: string[] = [];
  if (note) lines.push(note);
  if (seller.bsb) lines.push(`BSB : ${seller.bsb}`);
  if (seller.accountNo) lines.push(`Account No : ${seller.accountNo}`);
  if (seller.accountName) lines.push(`Acc Name : ${seller.accountName}`);
  if (seller.bankName) lines.push(`at ${seller.bankName}`);
  return lines;
}

export type TaxInvoiceLine = {
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  service_type: string | null;
  color: string | null;
  size: string | null;
};

/** Coerce Supabase / loose JSON into a safe shape for PDFKit (avoids runtime throws on bad types). */
export function sanitizeTaxInvoiceOrderForPdf(order: TaxInvoiceOrder | Record<string, unknown>): TaxInvoiceOrder {
  const o = order as Record<string, unknown>;
  const cents = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
  };
  const rawCreated = String(o.created_at ?? "").trim();
  const parsed = Date.parse(rawCreated);
  const created_at = Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  const refRaw = o.invoice_reference;
  const invoice_reference =
    refRaw == null || refRaw === ""
      ? null
      : String(refRaw).trim().slice(0, 500) || null;
  const orgRaw = o.customer_organisation;
  const customer_organisation =
    orgRaw == null || orgRaw === "" ? null : String(orgRaw).trim().slice(0, 500) || null;

  return {
    order_number: String(o.order_number ?? "").trim() || "—",
    created_at,
    customer_name: String(o.customer_name ?? "").trim(),
    customer_email: String(o.customer_email ?? "").trim(),
    delivery_address: String(o.delivery_address ?? "").trim() || "—",
    subtotal_cents: cents(o.subtotal_cents),
    delivery_fee_cents: cents(o.delivery_fee_cents),
    total_cents: Math.max(0, cents(o.total_cents)),
    currency: String(o.currency ?? "AUD").trim().slice(0, 8) || "AUD",
    invoice_reference,
    customer_organisation,
  };
}

export function sanitizeTaxInvoiceLinesForPdf(lines: readonly TaxInvoiceLine[] | unknown): TaxInvoiceLine[] {
  const arr = Array.isArray(lines) ? lines : [];
  return arr.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const qty = Number(r.quantity);
    const q = Number.isFinite(qty) && qty > 0 ? Math.min(99999, Math.floor(qty)) : 1;
    const unit = Number(r.unit_price_cents);
    const line = Number(r.line_total_cents);
    return {
      product_name: String(r.product_name ?? "Item").trim() || "Item",
      quantity: q,
      unit_price_cents: Number.isFinite(unit) && unit >= 0 ? Math.round(unit) : 0,
      line_total_cents: Number.isFinite(line) && line >= 0 ? Math.round(line) : 0,
      service_type: r.service_type == null || r.service_type === "" ? null : String(r.service_type),
      color: r.color == null || r.color === "" ? null : String(r.color),
      size: r.size == null || r.size === "" ? null : String(r.size),
    };
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shown on tax invoice PDF/HTML when `invoice_reference` is not set yet (entered manually next day). */
export const TAX_INVOICE_PENDING_INVOICE_NUMBER_NOTE = "will provide soon";

/** GST-inclusive assumption (AU): GST ≈ 1/11 of taxable GST-inclusive amount. */
export function gstIncludedFromTotalCents(totalCents: number): number {
  return Math.round(totalCents / 11);
}

export function buildStoreTaxInvoiceHtml(
  seller: TaxInvoiceSeller,
  order: TaxInvoiceOrder,
  lines: TaxInvoiceLine[],
): string {
  const issued = new Date(order.created_at).toLocaleString("en-AU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Australia/Perth",
  });
  const gstTotalCents = gstIncludedFromTotalCents(order.total_cents);
  const currency = order.currency || "AUD";

  const lineRows = lines
    .map((row) => {
      const bits = [row.service_type, row.color, row.size]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean);
      const desc = bits.length ? `${esc(row.product_name)} <span class="muted">(${esc(bits.join(" · "))})</span>` : esc(row.product_name);
      return `<tr>
        <td>${desc}</td>
        <td class="num">${row.quantity}</td>
        <td class="num">${formatMoneyFromCents(row.unit_price_cents, currency)}</td>
        <td class="num">${formatMoneyFromCents(row.line_total_cents, currency)}</td>
      </tr>`;
    })
    .join("");

  const sellerBlock = [
    esc(seller.legalName),
    seller.abn ? `ABN ${esc(seller.abn)}` : "",
    seller.addressLines ? esc(seller.addressLines).replace(/\n/g, "<br/>") : "",
  ]
    .filter(Boolean)
    .join("<br/>");

  const logoSrc = taxInvoiceLogoHtmlSrc();
  const logoUnderSeller =
    logoSrc && (seller.legalName || seller.abn)
      ? `<div style="text-align:left;font-size:0.88rem;line-height:1.35">
          ${seller.legalName ? `<div style="font-weight:600">${esc(seller.legalName)}</div>` : ""}
          ${seller.abn ? `<div class="muted" style="margin-top:0.15rem">ABN ${esc(seller.abn)}</div>` : ""}
        </div>`
      : "";
  const logoUnderSpacer = logoSrc
    ? `<div style="height:calc(2 * 1.35 * 0.88rem);min-height:2.4em" aria-hidden="true"></div>`
    : "";
  const logoBlock = logoSrc
    ? `<div style="display:flex;justify-content:flex-end;margin:0 0 1.25rem">
         <div style="width:8.25rem;text-align:left">
           <img src="${esc(logoSrc)}" alt="" style="max-height:52px;width:auto;display:block" />
           ${logoUnderSpacer}
           ${logoUnderSeller}
         </div>
       </div>`
    : "";

  const bankBlockLines = sellerBankBlockLines(seller);
  const bankBlockHtml = bankBlockLines.length
    ? `<div class="invoice-bank" style="margin-top:2rem;padding-top:1rem;border-top:1px solid #e2e8f0;font-size:0.95rem;line-height:1.55;color:#0f172a">
        ${bankBlockLines.map((l) => esc(l)).join("<br/>")}
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tax invoice ${esc(order.order_number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 2rem; color: #0f172a; background: #fff; line-height: 1.45; }
    .wrap { max-width: 44rem; margin: 0 auto; }
    h1 { font-size: 1.8rem; font-weight: 600; margin: 0 0 0.25rem; }
    .tag { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 1.5rem; }
    .grid { display: grid; gap: 1.5rem; margin-bottom: 1.5rem; }
    @media (min-width: 520px) { .grid { grid-template-columns: 1fr 1fr; } }
    .box { border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 1rem; font-size: 1.05rem; }
    .box h2 { font-size: 0.84rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin: 0 0 0.5rem; }
    .bill-to-box h2 { font-size: 1.26rem; }
    .bill-to-name { font-size: 1.575rem; line-height: 1.35; }
    table { width: 100%; border-collapse: collapse; font-size: 1.05rem; margin-top: 0.5rem; }
    th, td { text-align: left; padding: 0.5rem 0.35rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .totals { margin-top: 1rem; font-size: 1.05rem; }
    .totals .row { display: flex; justify-content: space-between; padding: 0.25rem 0; gap: 1rem; }
    .totals .strong { font-weight: 600; font-size: 1.2rem; margin-top: 0.35rem; padding-top: 0.5rem; border-top: 1px solid #cbd5e1; }
    .note { margin-top: 1.25rem; font-size: 0.96rem; color: #475569; }
    .muted { color: #64748b; font-weight: normal; }
    @media print { body { padding: 1rem; } }
  </style>
</head>
<body>
  <div class="wrap">
    ${logoBlock}
    <p class="tag">Tax invoice</p>
    <p class="muted" style="margin:0 0 0.35rem;font-size:0.84rem;text-transform:uppercase;letter-spacing:0.06em;">Order ID</p>
    <h1 style="margin:0 0 0.75rem;">${esc(order.order_number)}</h1>
    <p class="muted" style="margin:0 0 0.35rem;font-size:0.84rem;text-transform:uppercase;letter-spacing:0.06em;">Invoice number</p>
    ${
      (order.invoice_reference ?? "").trim()
        ? `<p style="margin:0 0 0.35rem;font-size:1.05rem;">${esc((order.invoice_reference ?? "").trim())}</p>`
        : `<p class="muted" style="margin:0 0 0.35rem;font-size:0.98rem;font-style:italic;">${esc(TAX_INVOICE_PENDING_INVOICE_NUMBER_NOTE)}</p>`
    }
    <p class="muted" style="margin:0 0 1.5rem;font-size:1.05rem;">Issued ${esc(issued)}</p>

    <div class="grid">
      <div class="box">
        <h2>From</h2>
        <div>${sellerBlock || '<span class="muted">Configure STORE_TAX_INVOICE_* in environment.</span>'}</div>
      </div>
      <div class="box bill-to-box">
        <h2>Bill to</h2>
        <div class="bill-to-name">
          <strong>${esc(billToDisplayName(order))}</strong>
        </div>
      </div>
    </div>

    <div class="box">
      <h2>Line items</h2>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="num">Qty</th>
            <th class="num">Unit</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineRows || `<tr><td colspan="4" class="muted">No lines</td></tr>`}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${formatMoneyFromCents(order.subtotal_cents, currency)}</span></div>
        <div class="row"><span>Delivery</span><span>${order.delivery_fee_cents === 0 ? "Free" : formatMoneyFromCents(order.delivery_fee_cents, currency)}</span></div>
        <div class="row strong"><span>Total (GST inclusive)</span><span>${formatMoneyFromCents(order.total_cents, currency)}</span></div>
      </div>
      <p class="note">
        Amounts are in ${esc(currency)} and include GST where applicable.
        Total GST included (estimated at 1/11 of the total): <strong>${formatMoneyFromCents(gstTotalCents, currency)}</strong>.
      </p>
    </div>
    ${bankBlockHtml}
  </div>
</body>
</html>`;
}

export function taxInvoiceFilename(orderNumber: string | null | undefined): string {
  const base = String(orderNumber ?? "").trim() || "order";
  const safe = base.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "order";
  return `Tax-invoice-${safe}.pdf`;
}

export function loadTaxInvoiceSellerFromEnv(): TaxInvoiceSeller {
  const legalName =
    process.env.STORE_TAX_INVOICE_LEGAL_NAME?.trim() ||
    process.env.STORE_SHIP_FROM_NAME?.trim() ||
    "Boss Workwear PTY LTD";
  const abn = process.env.STORE_TAX_INVOICE_ABN?.trim() || "54 132 117 018";
  const address =
    process.env.STORE_TAX_INVOICE_ADDRESS?.trim() ||
    process.env.STORE_SHIP_FROM_ADDRESS?.trim() ||
    "";
  const phone = process.env.STORE_TAX_INVOICE_PHONE?.trim() || STOREFRONT_PHONE_DISPLAY;
  const email = process.env.STORE_TAX_INVOICE_EMAIL?.trim() || STOREFRONT_QUOTE_EMAIL_RECIPIENT;
  const website = process.env.STORE_TAX_INVOICE_WEBSITE?.trim() || "";
  const bsb = process.env.STORE_TAX_INVOICE_BSB?.trim() || "016-363";
  const accountNo = process.env.STORE_TAX_INVOICE_ACCOUNT_NO?.trim() || "643762076";
  const accountName = process.env.STORE_TAX_INVOICE_ACCOUNT_NAME?.trim() || "BOSS WORKWEAR PTY LTD.";
  const bankName = process.env.STORE_TAX_INVOICE_BANK?.trim() || "ANZ Bank";
  const paymentNote =
    process.env.STORE_TAX_INVOICE_PAYMENT_NOTE?.trim() ||
    "Payment of our accounts can be made by Direct credit using the following account:";
  const dueRaw = process.env.STORE_TAX_INVOICE_DUE_DAYS?.trim();
  const dueDaysAfterInvoice = dueRaw ? Math.max(0, parseInt(dueRaw, 10) || 14) : 14;

  return {
    legalName,
    abn,
    addressLines: address,
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(website ? { website } : {}),
    bsb,
    accountNo,
    accountName,
    bankName,
    paymentNote,
    dueDaysAfterInvoice,
  };
}

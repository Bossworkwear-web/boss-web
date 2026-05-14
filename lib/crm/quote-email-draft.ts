import type { QuoteEmailProductLine } from "@/app/admin/(panel)/crm/quote-email-products";
import { formatMoneyFromCents } from "@/lib/store-order-utils";

export const DEFAULT_QUOTE_EMAIL_LEAD_TIME = "3~5 days dispatch";
const CURRENCY = "AUD";

/** First $… amount in the price field, or a plain positive number. */
export function parseUnitDollarsFromPriceField(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const dollar = s.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (dollar) {
    const n = Number.parseFloat(dollar[1].replace(/,/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const n = Number.parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseQuantityAsNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Sum of (unit price × quantity) per line in whole cents; null if no line qualifies. */
export function computeTotalCentsFromProductLines(lines: QuoteEmailProductLine[]): number | null {
  let cents = 0;
  let any = false;
  for (const line of lines) {
    const unit = parseUnitDollarsFromPriceField(line.price);
    const qty = parseQuantityAsNumber(line.quantity);
    if (unit !== null && qty !== null) {
      cents += Math.round(unit * qty * 100);
      any = true;
    }
  }
  return any ? cents : null;
}

export function formatDeliveryAddressEmailLines(d: {
  address1: string;
  address2: string;
  suburb: string;
  state: string;
  country: string;
}): string[] {
  const rows: { label: string; value: string }[] = [
    { label: "Address 1", value: d.address1.trim() },
    { label: "Address 2", value: d.address2.trim() },
    { label: "Suburb", value: d.suburb.trim() },
    { label: "State", value: d.state.trim() },
    { label: "Country", value: d.country.trim() },
  ];
  const filled = rows.filter((r) => r.value);
  if (filled.length === 0) return [];
  return [
    "Delivery address:",
    ...filled.map((r) => `  ${r.label}: ${r.value}`),
    "",
  ];
}

export function buildQuoteCustomerEmailBody(params: {
  contactName: string;
  companyName: string;
  products: QuoteEmailProductLine[];
  totalCents: number | null;
  leadTime: string;
  deliveryAddress: {
    address1: string;
    address2: string;
    suburb: string;
    state: string;
    country: string;
  };
  totalLineOverride?: string | null;
}): string {
  const totalLine =
    params.totalLineOverride ??
    (params.totalCents !== null && Number.isFinite(params.totalCents)
      ? `${formatMoneyFromCents(params.totalCents, CURRENCY)} (GST included)`
      : "— (set price per unit and quantity on each product line — total is calculated automatically)");

  const productLines: string[] = ["Products:"];
  const nonEmpty = params.products.filter(
    (p) =>
      p.product_id.trim() ||
      p.product_name.trim() ||
      p.size.trim() ||
      p.colour.trim() ||
      p.price.trim() ||
      p.quantity.trim(),
  );
  if (nonEmpty.length === 0) {
    productLines.push("  (none entered — add lines below)", "");
  } else {
    nonEmpty.forEach((p, i) => {
      productLines.push(`  ${i + 1}. Product ID: ${p.product_id.trim() || "—"}`);
      productLines.push(`     Product name: ${p.product_name.trim() || "—"}`);
      productLines.push(`     Size: ${p.size.trim() || "—"}`);
      productLines.push(`     Colour: ${p.colour.trim() || "—"}`);
      productLines.push(
        `     Price per unit (including Embroidery/Printing Service): ${p.price.trim() || "—"}`,
      );
      productLines.push(`     Quantity: ${p.quantity.trim() || "—"}`);
    });
    productLines.push("");
  }

  const deliveryLines = formatDeliveryAddressEmailLines(params.deliveryAddress);

  return [
    `Dear ${params.contactName || "customer"},`,
    "",
    `Thank you for your enquiry${params.companyName ? ` from ${params.companyName}` : ""}.`,
    "",
    "Please find your quote details below:",
    "",
    ...productLines,
    `Total amount (GST included): ${totalLine}`,
    `Expected lead time: ${params.leadTime.trim() || DEFAULT_QUOTE_EMAIL_LEAD_TIME}`,
    ...deliveryLines,
    "If you have any questions or would like to proceed, please reply to this email.",
    "",
    "Kind regards,",
    "Boss's Workwear",
  ].join("\n");
}

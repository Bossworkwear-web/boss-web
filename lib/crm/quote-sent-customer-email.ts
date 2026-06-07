import type { QuoteEmailProductLine } from "@/app/admin/(panel)/crm/quote-email-products";
import { formatMoneyFromCents } from "@/lib/store-order-utils";

import {
  buildQuoteCustomerEmailBody,
  computeTotalCentsFromProductLines,
  DEFAULT_QUOTE_EMAIL_LEAD_TIME,
} from "./quote-email-draft";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function quoteSentCustomerEmailSubject(companyName: string): string {
  return `Your quote — ${companyName.trim() || "Boss Workwear"}`;
}

export function buildQuoteSentCustomerEmailHtml(args: {
  contactName: string;
  plainTextBody: string;
  acceptUrl: string | null;
}): string {
  const bodyHtml = escapeHtml(args.plainTextBody);
  const acceptSection = args.acceptUrl
    ? (() => {
        const acceptHtml = escapeHtml(args.acceptUrl);
        return `
    <p><a href="${acceptHtml}">Review and accept your quote</a></p>
    <p style="font-size:12px;color:#64748b">If the button does not work, copy this link:<br/><code style="word-break:break-all">${acceptHtml}</code></p>`;
      })()
    : `
    <p style="font-size:13px;color:#64748b"><em>A unique online accept link will be generated when you mark this quote as sent.</em></p>`;

  return `
    <p>Hi ${escapeHtml(args.contactName)},</p>
    <p>Please find your quote below. To confirm details, complete any empty fields and accept online:</p>
    ${acceptSection}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
    <pre style="white-space:pre-wrap;font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;margin:0">${bodyHtml}</pre>
    <p style="margin-top:20px;font-size:13px;color:#64748b">Questions? Reply to this email.</p>
  `
    .replace(/\n\s+/g, " ")
    .trim();
}

export type QuoteSentEmailPreview = {
  to: string;
  subject: string;
  plainTextBody: string;
  html: string;
};

export function buildQuoteSentEmailPreviewFromFields(fields: {
  email: string;
  contact_name: string;
  company_name: string;
  quote_email_products: QuoteEmailProductLine[];
  quote_email_total_cents: number | null;
  quote_email_lead_time: string | null;
  quote_email_delivery_address_1: string | null;
  quote_email_delivery_address_2: string | null;
  quote_email_delivery_suburb: string | null;
  quote_email_delivery_state: string | null;
  quote_email_delivery_country: string | null;
  acceptUrl?: string | null;
}): QuoteSentEmailPreview | null {
  const to = fields.email?.trim();
  if (!to) return null;

  const computedTotal = computeTotalCentsFromProductLines(fields.quote_email_products);
  const savedCents = fields.quote_email_total_cents;
  const totalLineOverride =
    savedCents !== null && Number.isFinite(savedCents) && Number.isInteger(savedCents)
      ? `${formatMoneyFromCents(savedCents, "AUD")} (GST included)`
      : null;

  const plainTextBody = buildQuoteCustomerEmailBody({
    contactName: fields.contact_name,
    companyName: fields.company_name,
    products: fields.quote_email_products,
    totalCents: computedTotal,
    leadTime: fields.quote_email_lead_time?.trim() || DEFAULT_QUOTE_EMAIL_LEAD_TIME,
    deliveryAddress: {
      address1: fields.quote_email_delivery_address_1?.trim() ?? "",
      address2: fields.quote_email_delivery_address_2?.trim() ?? "",
      suburb: fields.quote_email_delivery_suburb?.trim() ?? "",
      state: fields.quote_email_delivery_state?.trim() ?? "",
      country: fields.quote_email_delivery_country?.trim() ?? "",
    },
    totalLineOverride,
  });

  const acceptUrl = fields.acceptUrl?.trim() || null;

  return {
    to,
    subject: quoteSentCustomerEmailSubject(fields.company_name),
    plainTextBody,
    html: buildQuoteSentCustomerEmailHtml({
      contactName: fields.contact_name,
      plainTextBody,
      acceptUrl,
    }),
  };
}

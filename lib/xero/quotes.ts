import { addCalendarDaysYmd, getPerthYmd, todayPerthYmd } from "@/lib/perth-calendar";
import { xeroAccountingJson } from "@/lib/xero/api-client";
import type { XeroConnectionRow } from "@/lib/xero/connection-db";

export type XeroQuoteLineInput = {
  description: string;
  quantity: number;
  unitAmountInclGst: number;
};

type XeroQuote = {
  QuoteID: string;
  QuoteNumber?: string;
  Reference?: string;
  Status?: string;
};

function getSalesAccountCode(): string {
  const code = process.env.XERO_SALES_ACCOUNT_CODE?.trim();
  if (!code) {
    throw new Error("XERO_SALES_ACCOUNT_CODE is not set (Xero Chart of Accounts sales/revenue code).");
  }
  return code;
}

function toXeroDateYmd(raw: string | null | undefined, fallback = new Date()): string {
  const trimmed = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const d = trimmed ? new Date(trimmed) : fallback;
  if (Number.isNaN(d.getTime())) {
    return todayPerthYmd();
  }
  return getPerthYmd(d).ymd;
}

export function xeroQuoteViewUrl(quoteId: string): string {
  return `https://go.xero.com/app/quotes/view/${encodeURIComponent(quoteId.trim())}`;
}

export async function createDraftSalesQuote(
  connection: XeroConnectionRow,
  input: {
    contactId: string;
    quoteNumber: string;
    reference: string;
    quoteDate: string;
    expiryDate: string;
    title?: string;
    summary?: string;
    lineItems: XeroQuoteLineInput[];
  },
): Promise<{ quoteId: string; quoteNumber: string }> {
  const lineItems = input.lineItems
    .filter((line) => line.description.trim())
    .map((line) => ({
      Description: line.description.trim().slice(0, 4000),
      Quantity: Math.max(line.quantity, 1),
      UnitAmount: Math.round(Math.max(0, line.unitAmountInclGst) * 100) / 100,
      AccountCode: getSalesAccountCode(),
      TaxType: "OUTPUT",
    }));

  if (!lineItems.length) {
    throw new Error("No quote line items to send to Xero.");
  }

  const payload = {
    Quotes: [
      {
        Contact: { ContactID: input.contactId },
        Date: toXeroDateYmd(input.quoteDate),
        ExpiryDate: toXeroDateYmd(input.expiryDate),
        LineAmountTypes: "Inclusive",
        LineItems: lineItems,
        QuoteNumber: input.quoteNumber.trim().slice(0, 255),
        Reference: input.reference.trim().slice(0, 255) || undefined,
        Title: input.title?.trim().slice(0, 100) || "Quote",
        Summary: input.summary?.trim().slice(0, 300) || undefined,
        Status: "DRAFT",
      },
    ],
  };

  const res = await xeroAccountingJson<{ Quotes?: XeroQuote[] }>(connection, "/Quotes", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const quote = res.Quotes?.[0];
  if (!quote?.QuoteID) {
    throw new Error("Xero did not return a quote id.");
  }

  const quoteNumber = (quote.QuoteNumber ?? input.quoteNumber).trim();
  if (!quoteNumber) {
    throw new Error("Xero quote created but QuoteNumber was empty.");
  }

  return { quoteId: quote.QuoteID, quoteNumber };
}

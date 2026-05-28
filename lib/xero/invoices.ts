import { addCalendarDaysYmd, getPerthYmd, todayPerthYmd } from "@/lib/perth-calendar";
import { xeroAccountingJson } from "@/lib/xero/api-client";
import type { XeroConnectionRow } from "@/lib/xero/connection-db";

export type XeroInvoiceLineInput = {
  description: string;
  quantity: number;
  unitAmountInclGst: number;
};

type XeroInvoice = {
  InvoiceID: string;
  InvoiceNumber?: string;
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

function toXeroDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return todayPerthYmd();
  }
  return getPerthYmd(d).ymd;
}

export async function createAuthorisedSalesInvoice(
  connection: XeroConnectionRow,
  input: {
    contactId: string;
    orderNumber: string;
    createdAt: string;
    lineItems: XeroInvoiceLineInput[];
  },
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  const lineItems = input.lineItems
    .filter((l) => l.quantity > 0 && Number.isFinite(l.unitAmountInclGst))
    .map((l) => ({
      Description: l.description.slice(0, 4000),
      Quantity: l.quantity,
      UnitAmount: Math.round(l.unitAmountInclGst * 100) / 100,
      AccountCode: getSalesAccountCode(),
      TaxType: "OUTPUT",
    }));

  if (!lineItems.length) {
    throw new Error("No invoice line items to send to Xero.");
  }

  const invoiceDate = toXeroDate(input.createdAt);
  const dueDate = addCalendarDaysYmd(invoiceDate, 14);

  const payload = {
    Invoices: [
      {
        Type: "ACCREC",
        Contact: { ContactID: input.contactId },
        Date: invoiceDate,
        DueDate: dueDate,
        LineAmountTypes: "Inclusive",
        LineItems: lineItems,
        Reference: input.orderNumber,
        Status: "AUTHORISED",
      },
    ],
  };

  const res = await xeroAccountingJson<{ Invoices?: XeroInvoice[] }>(connection, "/Invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const inv = res.Invoices?.[0];
  if (!inv?.InvoiceID) {
    throw new Error("Xero did not return an invoice id.");
  }

  const invoiceNumber = (inv.InvoiceNumber ?? "").trim();
  if (!invoiceNumber) {
    throw new Error("Xero invoice created but InvoiceNumber was empty.");
  }

  return { invoiceId: inv.InvoiceID, invoiceNumber };
}

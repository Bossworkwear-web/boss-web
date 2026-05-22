import { xeroAccountingJson } from "@/lib/xero/api-client";
import type { XeroConnectionRow } from "@/lib/xero/connection-db";

type XeroCreditNote = {
  CreditNoteID?: string;
  CreditNoteNumber?: string;
};

function getSalesAccountCode(): string {
  const code = process.env.XERO_SALES_ACCOUNT_CODE?.trim();
  if (!code) {
    throw new Error("XERO_SALES_ACCOUNT_CODE is not set.");
  }
  return code;
}

function toXeroDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/** Create an AUTHORISED ACCRECCREDIT credit note and allocate it to the sales invoice. */
export async function createRefundCreditNoteForInvoice(
  connection: XeroConnectionRow,
  input: {
    contactId: string;
    invoiceId: string;
    orderNumber: string;
    refundAmountAud: number;
    refundDate: string;
    stripeRefundId: string;
  },
): Promise<{ creditNoteId: string; creditNoteNumber: string }> {
  const amount = Math.round(input.refundAmountAud * 100) / 100;
  if (amount <= 0) {
    throw new Error("Credit note amount must be greater than zero.");
  }

  const reference = `Stripe refund ${input.stripeRefundId}`.slice(0, 255);
  const payload = {
    CreditNotes: [
      {
        Type: "ACCRECCREDIT",
        Contact: { ContactID: input.contactId },
        Date: toXeroDate(input.refundDate),
        LineAmountTypes: "Inclusive",
        LineItems: [
          {
            Description: `Refund — ${input.orderNumber}`.slice(0, 4000),
            Quantity: 1,
            UnitAmount: amount,
            AccountCode: getSalesAccountCode(),
            TaxType: "OUTPUT",
          },
        ],
        Reference: reference,
        Status: "AUTHORISED",
      },
    ],
  };

  const createRes = await xeroAccountingJson<{ CreditNotes?: XeroCreditNote[] }>(
    connection,
    "/CreditNotes",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  const cn = createRes.CreditNotes?.[0];
  const creditNoteId = (cn?.CreditNoteID ?? "").trim();
  if (!creditNoteId) {
    throw new Error("Xero did not return a credit note id.");
  }

  const allocatePayload = {
    Allocations: [
      {
        Invoice: { InvoiceID: input.invoiceId },
        Amount: amount,
      },
    ],
  };

  await xeroAccountingJson(connection, `/CreditNotes/${encodeURIComponent(creditNoteId)}/Allocations`, {
    method: "PUT",
    body: JSON.stringify(allocatePayload),
  });

  return {
    creditNoteId,
    creditNoteNumber: (cn?.CreditNoteNumber ?? "").trim() || creditNoteId,
  };
}

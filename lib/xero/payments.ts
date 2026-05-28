import { getPerthYmd, todayPerthYmd } from "@/lib/perth-calendar";
import { xeroAccountingJson } from "@/lib/xero/api-client";
import type { XeroConnectionRow } from "@/lib/xero/connection-db";

type XeroInvoice = {
  InvoiceID?: string;
  AmountDue?: number;
  AmountPaid?: number;
  Status?: string;
};

type XeroPayment = {
  PaymentID?: string;
};

function getBankAccountCode(): string {
  const code = process.env.XERO_BANK_ACCOUNT_CODE?.trim();
  if (!code) {
    throw new Error(
      "XERO_BANK_ACCOUNT_CODE is not set (Xero bank account code for Stripe payment recording).",
    );
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

export async function getXeroInvoice(
  connection: XeroConnectionRow,
  invoiceId: string,
): Promise<{ amountDue: number; amountPaid: number; status: string }> {
  const res = await xeroAccountingJson<{ Invoices?: XeroInvoice[] }>(
    connection,
    `/Invoices/${encodeURIComponent(invoiceId)}`,
  );
  const inv = res.Invoices?.[0];
  if (!inv?.InvoiceID) {
    throw new Error("Xero invoice not found.");
  }
  return {
    amountDue: Number(inv.AmountDue) || 0,
    amountPaid: Number(inv.AmountPaid) || 0,
    status: (inv.Status ?? "").trim(),
  };
}

export function invoiceAlreadyPaid(amountDue: number, amountPaid: number): boolean {
  return amountDue <= 0.005 || amountPaid > 0 && amountDue <= 0.005;
}

/** Record a payment against an ACCREC invoice (marks it Paid in Xero when fully paid). */
export async function recordPaymentForInvoice(
  connection: XeroConnectionRow,
  input: {
    invoiceId: string;
    amountAud: number;
    paymentDate: string;
    reference?: string;
  },
): Promise<{ paymentId: string }> {
  const amount = Math.round(input.amountAud * 100) / 100;
  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const inv = await getXeroInvoice(connection, input.invoiceId);
  if (invoiceAlreadyPaid(inv.amountDue, inv.amountPaid)) {
    return { paymentId: "" };
  }

  const payAmount = Math.min(amount, Math.round(inv.amountDue * 100) / 100);
  if (payAmount <= 0) {
    return { paymentId: "" };
  }

  const payload = {
    Payments: [
      {
        Invoice: { InvoiceID: input.invoiceId },
        Account: { Code: getBankAccountCode() },
        Date: toXeroDate(input.paymentDate),
        Amount: payAmount,
        ...(input.reference ? { Reference: input.reference.slice(0, 255) } : {}),
      },
    ],
  };

  const res = await xeroAccountingJson<{ Payments?: XeroPayment[] }>(connection, "/Payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const paymentId = (res.Payments?.[0]?.PaymentID ?? "").trim();
  if (!paymentId) {
    throw new Error("Xero did not return a payment id.");
  }

  return { paymentId };
}

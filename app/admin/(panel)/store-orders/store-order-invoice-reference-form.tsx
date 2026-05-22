"use client";

import { useEffect, useState, useTransition } from "react";

import {
  resendStoreOrderInvoiceEmail,
  submitStoreOrderInvoiceReferenceForm,
} from "@/app/admin/(panel)/store-orders/actions";

const TRACKING_TOKEN_RE = /^[0-9a-f-]{36}$/i;

export function StoreOrderInvoiceReferenceForm({
  orderId,
  initialReference,
  className,
  /** After a successful save, redirect here so the list (and PDF data) reloads. Use `/admin/customer-invoices` on that page. */
  returnAfterSave,
  inputPlaceholder = "e.g. Xero INV-12345",
  /** When set (store order UUID), admin preview uses `orderId` + admin session cookie (Customer Invoices). */
  taxInvoicePreviewOrderId,
  /** Legacy: public tracking token URL when order-id preview is not used. */
  taxInvoicePreviewToken,
  /** Shown in the invoice preview modal title (e.g. customer order id). */
  invoicePreviewOrderLabel,
  /** ~20% larger label/input/button text (Customer Invoices list column). */
  scaledListTypography = false,
  /** Green/red dot before the field: green when the input has text, red when empty (Customer Invoices). */
  showInvoiceReferenceStatusDot = false,
}: {
  orderId: string;
  initialReference: string | null;
  /** Optional layout wrapper (default matches Store orders table). */
  className?: string;
  returnAfterSave?: string;
  inputPlaceholder?: string;
  taxInvoicePreviewOrderId?: string | null;
  taxInvoicePreviewToken?: string | null;
  invoicePreviewOrderLabel?: string;
  scaledListTypography?: boolean;
  showInvoiceReferenceStatusDot?: boolean;
}) {
  const [reference, setReference] = useState(() => initialReference ?? "");
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [resendPending, startResend] = useTransition();

  const orderIdOk =
    typeof taxInvoicePreviewOrderId === "string" &&
    taxInvoicePreviewOrderId.trim().length > 0 &&
    TRACKING_TOKEN_RE.test(taxInvoicePreviewOrderId.trim());
  const tokenOk =
    typeof taxInvoicePreviewToken === "string" &&
    taxInvoicePreviewToken.trim().length > 0 &&
    TRACKING_TOKEN_RE.test(taxInvoicePreviewToken.trim());
  const invoicePreviewSrc = orderIdOk
    ? `/api/orders/tax-invoice?orderId=${encodeURIComponent(taxInvoicePreviewOrderId.trim())}&inline=1`
    : tokenOk
      ? `/api/orders/tax-invoice?token=${encodeURIComponent(taxInvoicePreviewToken.trim())}&inline=1`
      : null;

  useEffect(() => {
    setReference(initialReference ?? "");
  }, [orderId, initialReference]);

  useEffect(() => {
    if (!invoicePreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInvoicePreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [invoicePreviewOpen]);

  useEffect(() => {
    setInvoicePreviewOpen(false);
  }, [orderId]);

  const labelTextClass = scaledListTypography ? "text-[0.78rem]" : "text-[0.65rem]";
  const inputTextClass = scaledListTypography ? "text-[0.9rem]" : "text-xs";
  const btnTextClass = scaledListTypography ? "text-[0.84rem]" : "text-[0.7rem]";
  const hasInvoiceReferenceText = reference.trim().length > 0;

  const fields = (
    <>
      <label className={`block ${labelTextClass} font-semibold uppercase tracking-wide text-slate-500`}>
        Invoice number
        <input
          name="invoice_reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={500}
          placeholder={inputPlaceholder}
          autoComplete="off"
          className={`mt-0.5 w-full rounded border border-slate-200 px-2 py-1 font-mono ${inputTextClass} text-brand-navy placeholder:text-slate-400`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className={`rounded border border-slate-200 bg-slate-50 px-2 py-1 ${btnTextClass} font-semibold whitespace-nowrap text-brand-navy shadow-sm hover:border-brand-orange hover:text-brand-orange`}
        >
          Save
        </button>
        {invoicePreviewSrc ? (
          <button
            type="button"
            className={`rounded border border-slate-200 bg-white px-2 py-1 ${btnTextClass} font-semibold whitespace-nowrap text-brand-navy shadow-sm hover:border-brand-orange hover:text-brand-orange`}
            onClick={() => setInvoicePreviewOpen(true)}
          >
            Show Invoice
          </button>
        ) : null}
        <button
          type="button"
          disabled={!hasInvoiceReferenceText || resendPending}
          title={
            hasInvoiceReferenceText
              ? "Email tax invoice PDF to the customer"
              : "Enter or sync an invoice number first"
          }
          className={`rounded border border-brand-orange/40 bg-brand-orange/10 px-2 py-1 ${btnTextClass} font-semibold whitespace-nowrap text-brand-navy shadow-sm hover:bg-brand-orange/20 disabled:cursor-not-allowed disabled:opacity-50`}
          onClick={() => {
            setResendMsg(null);
            startResend(async () => {
              const res = await resendStoreOrderInvoiceEmail(orderId);
              if (res.ok) {
                setResendMsg({ kind: "ok", text: "Invoice email sent." });
              } else {
                setResendMsg({ kind: "err", text: res.error });
              }
            });
          }}
        >
          {resendPending ? "Sending…" : "Resend invoice email"}
        </button>
      </div>
      {resendMsg ? (
        <p
          className={
            resendMsg.kind === "ok"
              ? `${btnTextClass} text-emerald-700`
              : `${btnTextClass} text-red-700`
          }
        >
          {resendMsg.text}
        </p>
      ) : null}
    </>
  );

  return (
    <>
      <form className={className ?? "mt-2 max-w-[14rem] space-y-1"} action={submitStoreOrderInvoiceReferenceForm}>
        <input type="hidden" name="orderId" value={orderId} />
        {returnAfterSave ? <input type="hidden" name="returnTo" value={returnAfterSave} /> : null}
        {showInvoiceReferenceStatusDot ? (
          <div className="flex gap-2.5 items-start">
            <span
              className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full shadow-inner ring-1 ring-black/10 ${
                hasInvoiceReferenceText ? "bg-emerald-500" : "bg-red-500"
              }`}
              role="status"
              aria-label={hasInvoiceReferenceText ? "Invoice number has a value" : "Invoice number is empty"}
              title={hasInvoiceReferenceText ? "Invoice number entered" : "No invoice number"}
            />
            <div className="min-w-0 flex-1 space-y-1">{fields}</div>
          </div>
        ) : (
          fields
        )}
      </form>

      {invoicePreviewOpen && invoicePreviewSrc ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setInvoicePreviewOpen(false);
          }}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tax-invoice-preview-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 id="tax-invoice-preview-title" className="text-sm font-semibold text-brand-navy">
                Tax invoice
                {invoicePreviewOrderLabel ? (
                  <span className="ml-2 font-mono font-normal text-slate-600">({invoicePreviewOrderLabel})</span>
                ) : null}
              </h2>
              <div className="flex items-center gap-2">
                <a
                  href={invoicePreviewSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-brand-orange underline"
                >
                  Open in new tab
                </a>
                <button
                  type="button"
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-brand-orange hover:text-brand-orange"
                  onClick={() => setInvoicePreviewOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <iframe title="Tax invoice PDF" className="min-h-[70vh] w-full flex-1 border-0 bg-slate-100" src={invoicePreviewSrc} />
          </div>
        </div>
      ) : null}
    </>
  );
}

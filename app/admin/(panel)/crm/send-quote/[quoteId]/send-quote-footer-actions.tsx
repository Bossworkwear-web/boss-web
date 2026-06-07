"use client";

import type { QuoteSentEmailPreview } from "@/lib/crm/quote-sent-customer-email";

import { MarkQuoteSentButton } from "./mark-quote-sent-button";
import { PreviewQuoteSentEmailButton } from "./preview-quote-sent-email-button";

export function SendQuoteFooterActions({
  quoteId,
  preview,
  canSend,
}: {
  quoteId: string;
  preview: QuoteSentEmailPreview | null;
  canSend?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <PreviewQuoteSentEmailButton preview={preview} />
        <MarkQuoteSentButton quoteId={quoteId} disabled={!canSend} />
      </div>
      {!preview ? (
        <p className="text-xs text-amber-800">
          Add a customer email on this quote to preview the message before sending.
        </p>
      ) : null}
      <p className="text-xs text-slate-500">
        <strong>Preview</strong> shows the saved customer email draft. <strong>Mark as quote sent</strong> emails it
        (with an online accept link) via Resend; the deal moves to <strong>Quote sent</strong> only after the provider
        accepts the message. Requires <code className="rounded bg-slate-100 px-1">RESEND_API_KEY</code> and a valid
        customer email.
      </p>
    </div>
  );
}

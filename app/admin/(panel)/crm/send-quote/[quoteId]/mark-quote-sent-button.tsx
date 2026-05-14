"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { sendQuoteEmailToCustomerAndMarkQuoteSent } from "../../actions";

export function MarkQuoteSentButton({ quoteId, disabled }: { quoteId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={disabled || pending}
        className="rounded-xl bg-brand-orange px-6 py-3 text-sm font-semibold text-brand-navy transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await sendQuoteEmailToCustomerAndMarkQuoteSent(quoteId);
            if (!r.ok) {
              setError(r.error ?? "Something went wrong");
              return;
            }
            router.push("/admin/crm");
            router.refresh();
          });
        }}
      >
        {pending ? "Sending email…" : "Mark as quote sent"}
      </button>
      <p className="text-xs text-slate-500">
        Sends the <strong>customer email draft</strong> (and online accept link) to the customer via email. The deal
        moves to <strong>Quote sent</strong> only after the message is accepted by the email provider. Requires{" "}
        <code className="rounded bg-slate-100 px-1">RESEND_API_KEY</code> and a valid customer email.
      </p>
    </div>
  );
}

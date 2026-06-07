"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { createCustomerQuoteFromCart } from "@/app/cart/quote-actions";
import { trackCartQuoteSaved } from "@/lib/analytics";
import type { CreateCustomerQuotePayload } from "@/lib/customer-quote";

type SendCartQuoteButtonProps = {
  isSignedIn: boolean;
  /** Built from the current cart + computed Cart Summary totals. */
  payload: CreateCustomerQuotePayload;
};

export function SendCartQuoteButton({ isSignedIn, payload }: SendCartQuoteButtonProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isSignedIn) {
    return (
      <div className="rounded-2xl border border-brand-navy/15 bg-brand-surface/50 px-5 py-5">
        <h2 className="text-[1.2rem] font-semibold text-brand-navy">Email this cart to yourself as a quote</h2>
        <p className="mt-1.5 text-[1.05rem] leading-snug text-brand-navy/70">
          Please{" "}
          <Link href="/log-in" className="font-semibold text-brand-orange underline hover:text-brand-orange/90">
            sign in
          </Link>{" "}
          first. After signing in, you can email the current cart to yourself as a quote and reorder it any time from
          My account.
        </p>
      </div>
    );
  }

  function handleSend() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await createCustomerQuoteFromCart(payload);
        if (!result.ok) {
          setMessage({ ok: false, text: result.error });
          return;
        }
        trackCartQuoteSaved({
          quote_number: result.quoteNumber,
          value_aud: payload.totalCents / 100,
          line_count: payload.lines.length,
          quantity: payload.totalQuantity,
        });

        if (result.emailSent) {
          setMessage({ ok: true, text: `Quote ${result.quoteNumber} sent to your email and saved to My account.` });
        } else {
          setMessage({
            ok: true,
            text: `Quote ${result.quoteNumber} saved to My account.${
              result.emailError ? ` Email could not be sent (${result.emailError}).` : ""
            }`,
          });
        }
      } catch {
        setMessage({ ok: false, text: "Something went wrong. Please try again." });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-brand-navy/15 bg-brand-surface/50 px-5 py-5">
      <h2 className="text-[1.2rem] font-semibold text-brand-navy">Email this cart to yourself as a quote</h2>
      <p className="mt-1.5 text-[1.05rem] leading-snug text-brand-navy/70">
        We&apos;ll email you a copy and save it under My account → My Quote so you can reorder it any time.
      </p>
      <button
        type="button"
        onClick={handleSend}
        disabled={pending || payload.lines.length === 0}
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-navy px-5 py-3 text-[1.2rem] font-semibold text-white transition hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send email to you as a Quote"}
      </button>
      {message ? (
        <p className={`mt-3 text-[1.05rem] ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
      ) : null}
    </div>
  );
}

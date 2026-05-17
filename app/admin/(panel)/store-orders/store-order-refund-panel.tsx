"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  linkStoreOrderStripeCheckoutSession,
  refundStoreOrderViaStripe,
} from "@/app/admin/(panel)/store-orders/refund-actions";
import { formatMoneyFromCents } from "@/lib/store-order-utils";

type Props = {
  orderId: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  currency: string;
  refundedCents: number;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  refundedAt: string | null;
};

export function StoreOrderRefundPanel({
  orderId,
  orderNumber,
  status,
  totalCents,
  currency,
  refundedCents,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
  refundedAt,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionInput, setSessionInput] = useState(stripeCheckoutSessionId ?? "");
  const [partialAud, setPartialAud] = useState("");

  const refundableCents = Math.max(0, totalCents - refundedCents);
  const hasStripePayment = Boolean(stripePaymentIntentId?.trim());

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        setMessage("Refund submitted. Card refunds usually appear in 5–10 business days.");
        setPartialAud("");
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="no-print mt-6 rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
      <h2 className="text-sm font-semibold text-brand-navy">Stripe refund (to card)</h2>
      <p className="mt-1 text-xs text-slate-600">
        Refunds return to the customer&apos;s card via Stripe. Order{" "}
        <span className="font-mono font-semibold">{orderNumber}</span>
        {hasStripePayment ? (
          <>
            {" "}
            · Payment <span className="font-mono text-[0.65rem]">{stripePaymentIntentId}</span>
          </>
        ) : null}
      </p>

      <dl className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Order total</dt>
          <dd className="font-medium tabular-nums text-brand-navy">
            {formatMoneyFromCents(totalCents, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Refunded</dt>
          <dd className="font-medium tabular-nums text-brand-navy">
            {formatMoneyFromCents(refundedCents, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Refundable</dt>
          <dd className="font-medium tabular-nums text-brand-navy">
            {formatMoneyFromCents(refundableCents, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd className="font-medium capitalize text-brand-navy">{status}</dd>
        </div>
        {refundedAt ? (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Last refund</dt>
            <dd className="font-medium text-brand-navy">
              {new Date(refundedAt).toLocaleString("en-AU", { timeZone: "Australia/Perth" })}
            </dd>
          </div>
        ) : null}
      </dl>

      {!hasStripePayment ? (
        <div className="mt-4">
          <p className="text-xs font-semibold text-brand-navy">Link Stripe payment (pi_… or cs_…)</p>
          <p className="text-[0.65rem] text-slate-500">
            Stripe → Payments → open the A$8.30 payment → copy <strong>Payment ID</strong> (
            <span className="font-mono">pi_…</span>) from the right sidebar. Required for orders placed before Stripe
            ids were saved.
          </p>
          <input
            type="text"
            value={sessionInput}
            onChange={(e) => setSessionInput(e.target.value)}
            placeholder="pi_3TXzvV1o2VOZJ3CB0p8FmJ6x"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            disabled={pending}
          />
          <button
            type="button"
            disabled={
              pending ||
              (!sessionInput.trim().startsWith("cs_") && !sessionInput.trim().startsWith("pi_"))
            }
            onClick={() =>
              run(() => linkStoreOrderStripeCheckoutSession(orderId, sessionInput.trim()))
            }
            className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-50"
          >
            Link payment
          </button>
        </div>
      ) : null}

      {refundableCents > 0 && hasStripePayment && status !== "unpaid" ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-brand-navy">Partial refund (AUD, optional)</p>
          <p className="text-[0.65rem] text-slate-500">Leave blank when using full refund only.</p>
          <input
            type="text"
            inputMode="decimal"
            value={partialAud}
            onChange={(e) => setPartialAud(e.target.value)}
            placeholder={(refundableCents / 100).toFixed(2)}
            className="w-full max-w-[12rem] rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            disabled={pending}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => refundStoreOrderViaStripe(orderId))}
              className="rounded-lg bg-brand-orange px-4 py-2 text-xs font-semibold text-white hover:bg-brand-orange/90 disabled:opacity-50"
            >
              {pending ? "Processing…" : "Refund full amount to card"}
            </button>
            <button
              type="button"
              disabled={pending || !partialAud.trim()}
              onClick={() => {
                const parsed = Number.parseFloat(partialAud.replace(/,/g, "").trim());
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  setError("Enter a valid refund amount in AUD.");
                  return;
                }
                run(() =>
                  refundStoreOrderViaStripe(orderId, { amountCents: Math.round(parsed * 100) }),
                );
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-50"
            >
              Refund partial amount
            </button>
          </div>
        </div>
      ) : null}

      {refundableCents <= 0 && hasStripePayment ? (
        <p className="mt-3 text-xs font-medium text-emerald-800">Fully refunded on file.</p>
      ) : null}

      {error ? <p className="mt-3 text-xs font-medium text-red-700">{error}</p> : null}
      {message ? <p className="mt-3 text-xs font-medium text-emerald-800">{message}</p> : null}
    </div>
  );
}

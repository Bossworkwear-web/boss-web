"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  issueStoreCreditForOrder,
  loadStoreCreditPanelContext,
} from "@/app/admin/(panel)/store-orders/store-credit-actions";
import { formatMoneyFromCents } from "@/lib/store-order-utils";

type Props = {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  totalCents: number;
  refundedCents: number;
  currency: string;
  /** When true, credit panel starts expanded. */
  defaultOpen?: boolean;
};

export function StoreOrderCreditPanel({
  orderId,
  orderNumber,
  customerEmail,
  totalCents,
  refundedCents,
  currency,
  defaultOpen = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partialAud, setPartialAud] = useState("");
  const [note, setNote] = useState("");
  const [balanceCents, setBalanceCents] = useState(0);
  const [creditIssuedForOrderCents, setCreditIssuedForOrderCents] = useState(0);
  const [panelOpen, setPanelOpen] = useState(defaultOpen);

  const maxCreditCents = Math.max(0, totalCents - refundedCents - creditIssuedForOrderCents);

  useEffect(() => {
    if (!panelOpen && !defaultOpen) return;
    let cancelled = false;
    void (async () => {
      const res = await loadStoreCreditPanelContext(orderId);
      if (cancelled || !res.ok) return;
      setBalanceCents(res.balanceCents);
      setCreditIssuedForOrderCents(res.creditIssuedForOrderCents);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, panelOpen, defaultOpen]);

  function runIssue(amountCents: number) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await issueStoreCreditForOrder(orderId, {
        amountCents,
        note: note.trim() || undefined,
      });
      if (res.ok) {
        setBalanceCents(res.balanceCents);
        const ctx = await loadStoreCreditPanelContext(orderId);
        if (ctx.ok) {
          setCreditIssuedForOrderCents(ctx.creditIssuedForOrderCents);
        }
        setMessage(
          `Store credit issued. Customer balance is now ${formatMoneyFromCents(res.balanceCents, currency)} — usable on their next order.`,
        );
        setPartialAud("");
        setNote("");
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  function refreshBalance() {
    startTransition(async () => {
      const res = await loadStoreCreditPanelContext(orderId);
      if (res.ok) {
        setBalanceCents(res.balanceCents);
        setCreditIssuedForOrderCents(res.creditIssuedForOrderCents);
      }
    });
  }

  return (
    <details
      open={panelOpen}
      onToggle={(e) => setPanelOpen(e.currentTarget.open)}
      className="no-print group mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/50"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <svg
          className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm font-semibold text-brand-navy">Store credit (next order)</span>
        <span className="ml-auto text-right text-xs font-medium tabular-nums text-slate-600">
          Balance {formatMoneyFromCents(balanceCents, currency)}
        </span>
      </summary>

      <div className="border-t border-emerald-200/80 px-4 pb-4 pt-3">
        <p className="text-xs text-slate-600">
          Issue store credit instead of a card refund when the customer prefers credit. Credit is tied to{" "}
          <span className="font-mono text-[0.65rem]">{customerEmail}</span> and applies automatically at checkout on
          their next order.
        </p>

        <dl className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Order</dt>
            <dd className="font-medium font-mono text-brand-navy">{orderNumber}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Customer balance</dt>
            <dd className="font-medium tabular-nums text-brand-navy">
              {formatMoneyFromCents(balanceCents, currency)}
              <button
                type="button"
                onClick={() => refreshBalance()}
                disabled={pending}
                className="ml-2 text-[0.65rem] font-semibold text-brand-orange hover:underline disabled:opacity-50"
              >
                Refresh
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Credit already issued (this order)</dt>
            <dd className="font-medium tabular-nums text-brand-navy">
              {formatMoneyFromCents(creditIssuedForOrderCents, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Max credit from this order</dt>
            <dd className="font-medium tabular-nums text-brand-navy">
              {formatMoneyFromCents(maxCreditCents, currency)}
            </dd>
          </div>
        </dl>

        {maxCreditCents > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-brand-navy">Issue credit (AUD)</p>
            <input
              type="text"
              inputMode="decimal"
              value={partialAud}
              onChange={(e) => setPartialAud(e.target.value)}
              placeholder={(maxCreditCents / 100).toFixed(2)}
              className="w-full max-w-[12rem] rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
              disabled={pending}
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (e.g. return — wrong size)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              disabled={pending}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => runIssue(maxCreditCents)}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {pending ? "Processing…" : "Issue full remaining credit"}
              </button>
              <button
                type="button"
                disabled={pending || !partialAud.trim()}
                onClick={() => {
                  const parsed = Number.parseFloat(partialAud.replace(/,/g, "").trim());
                  if (!Number.isFinite(parsed) || parsed <= 0) {
                    setError("Enter a valid credit amount in AUD.");
                    return;
                  }
                  runIssue(Math.round(parsed * 100));
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-50"
              >
                Issue partial credit
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs font-medium text-slate-600">
            No remaining amount on this order for new credit (after card refunds and credit already issued).
          </p>
        )}

        {error ? <p className="mt-3 text-xs font-medium text-red-700">{error}</p> : null}
        {message ? <p className="mt-3 text-xs font-medium text-emerald-800">{message}</p> : null}
      </div>
    </details>
  );
}

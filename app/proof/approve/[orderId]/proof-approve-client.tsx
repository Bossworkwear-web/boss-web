"use client";

import { useState, useTransition } from "react";

import { submitOrderProofDecision } from "@/app/proof/approve/actions";

export function ProofApproveClient({
  storeOrderId,
  token,
}: {
  storeOrderId: string;
  token: string;
}) {
  const [mode, setMode] = useState<"idle" | "decline">("idle");
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "declined" | null>(null);

  function submit(decision: "approve" | "decline") {
    setError(null);
    startTransition(async () => {
      const res = await submitOrderProofDecision(storeOrderId, token, decision, comment);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(res.status);
    });
  }

  if (done === "approved") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
        <p className="text-base font-semibold">Thanks — your proof is approved!</p>
        <p className="mt-1">
          We&apos;ll start production now. You&apos;ll get an update when your order moves to the next stage.
        </p>
      </div>
    );
  }

  if (done === "declined") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <p className="text-base font-semibold">Got it — we&apos;ll revise the proof.</p>
        <p className="mt-1">
          Our team will update the design based on your notes and send you a new proof to review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}

      {mode === "idle" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => submit("approve")}
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand-orange px-5 py-3 text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : "Approve this proof"}
          </button>
          <button
            type="button"
            onClick={() => setMode("decline")}
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition hover:bg-slate-50 disabled:opacity-50"
          >
            Request changes
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-brand-navy">
            What would you like us to change?
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="e.g. Make the logo larger, change thread colour to navy…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-orange focus:outline-none"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => submit("decline")}
              disabled={pending || !comment.trim()}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send change request"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setError(null);
              }}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition hover:bg-slate-50 disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

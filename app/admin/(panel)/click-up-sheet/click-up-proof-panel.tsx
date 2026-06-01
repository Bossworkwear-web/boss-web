"use client";

import { useEffect, useState } from "react";

import { OrderProofPanel } from "@/app/admin/(panel)/production/[id]/order-proof-panel";
import { loadProofContextByOrderNumber } from "@/app/admin/(panel)/production/proof-actions";
import type { OrderProofRecord } from "@/lib/order-proof";

import type { ClickUpSheetImageDto } from "./actions";

type ProofContext = {
  storeOrderId: string;
  orderNumber: string;
  mockupImages: ClickUpSheetImageDto[];
  proofs: OrderProofRecord[];
};

/**
 * Click-up sheet wrapper for the Customer proof approval panel. Resolves the store order + its mock-ups and
 * proof history from the Customer Order ID currently loaded on the sheet, so staff can send the design proof
 * (시안) straight from where they build the mock-ups.
 */
export function ClickUpProofPanel({ customerOrderId }: { customerOrderId: string }) {
  const [ctx, setCtx] = useState<ProofContext | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const num = customerOrderId.trim();
    let cancelled = false;

    if (!num) {
      setCtx(null);
      setState("idle");
      setError(null);
      return;
    }

    setState("loading");
    setError(null);
    const timer = window.setTimeout(() => {
      void loadProofContextByOrderNumber(num).then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setCtx(null);
          setState("error");
          setError(res.error);
          return;
        }
        setCtx({
          storeOrderId: res.storeOrderId,
          orderNumber: res.orderNumber,
          mockupImages: res.mockupImages,
          proofs: res.proofs,
        });
        setState("ready");
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerOrderId]);

  if (state === "idle") {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <h2 className="text-lg font-medium text-brand-navy">Customer proof approval</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter a Customer Order ID above to send the design proof (시안) for approval.
        </p>
      </section>
    );
  }

  if (state === "loading") {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <h2 className="text-lg font-medium text-brand-navy">Customer proof approval</h2>
        <p className="mt-1 text-sm text-slate-500">Loading proof status…</p>
      </section>
    );
  }

  if (state === "error" || !ctx) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm print:hidden">
        <h2 className="text-lg font-medium text-brand-navy">Customer proof approval</h2>
        <p className="mt-1 text-sm text-amber-800">{error ?? "Could not load this order."}</p>
      </section>
    );
  }

  return (
    <OrderProofPanel
      key={ctx.storeOrderId}
      orderId={ctx.storeOrderId}
      orderNumber={ctx.orderNumber}
      mockupImages={ctx.mockupImages}
      initialProofs={ctx.proofs}
    />
  );
}

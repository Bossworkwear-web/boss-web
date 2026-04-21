"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  buildDeliveryTimeline,
  type DeliveryTimelineStep,
  type OrderTrackDeliveryPayload,
} from "@/lib/order-track-delivery";
import { australiaPostTrackingUrl } from "@/lib/store-order-utils";

const POLL_MS = 20_000;

function dotClass(dot: DeliveryTimelineStep["dot"]): string {
  switch (dot) {
    case "complete":
      return "border-brand-orange bg-brand-orange text-white";
    case "current":
      return "border-brand-orange bg-white text-brand-orange ring-2 ring-brand-orange/40";
    case "cancelled":
      return "border-slate-300 bg-slate-200 text-slate-500";
    default:
      return "border-brand-navy/20 bg-white text-transparent";
  }
}

function lineClass(step: DeliveryTimelineStep, next: DeliveryTimelineStep | undefined): string {
  if (!next) {
    return "bg-transparent";
  }
  const done = step.dot === "complete" || step.dot === "cancelled";
  const nextDone = next.dot === "complete" || next.dot === "cancelled";
  if (done && nextDone) {
    return "bg-brand-orange/50";
  }
  if (done && next.dot === "current") {
    return "bg-gradient-to-b from-brand-orange/50 to-brand-navy/15";
  }
  if (step.dot === "current") {
    return "bg-brand-navy/15";
  }
  return "bg-brand-navy/10";
}

type Props = {
  trackingToken: string;
  initialPayload: OrderTrackDeliveryPayload;
  initialAusPostUrl: string | null;
};

export function OrderDeliveryStatusTracker({ trackingToken, initialPayload, initialAusPostUrl }: Props) {
  const [payload, setPayload] = useState<OrderTrackDeliveryPayload>(initialPayload);
  const [ausPostUrl, setAusPostUrl] = useState<string | null>(initialAusPostUrl);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/track-status?token=${encodeURIComponent(trackingToken)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setFetchError("Could not refresh status.");
        return;
      }
      setFetchError(null);
      const next = (await res.json()) as OrderTrackDeliveryPayload;
      setPayload(next);
      const tn = next.tracking_number?.trim();
      const carrier = (next.carrier ?? "").toLowerCase();
      const ap =
        next.status === "shipped" &&
        tn &&
        (carrier.includes("australia post") || carrier.includes("auspost"))
          ? australiaPostTrackingUrl(tn)
          : null;
      setAusPostUrl(ap);
    } catch {
      setFetchError("Could not refresh status.");
    }
  }, [trackingToken]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const steps = buildDeliveryTimeline(payload);
  const cancelled = payload.status.trim().toLowerCase() === "cancelled";

  return (
    <div className="mt-4">
      {cancelled ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[1.125rem] text-amber-950">
          This order has been cancelled. If you think this is a mistake, please contact us.
        </p>
      ) : null}
      <p className="mb-2 text-[0.75rem] font-medium uppercase tracking-wide text-brand-navy/45">
        Refreshes automatically about every {POLL_MS / 1000}s
      </p>
      {fetchError ? (
        <p className="mb-3 text-sm text-amber-800" role="status">
          {fetchError}
        </p>
      ) : null}
      <ol className="relative space-y-0 pl-2">
        {steps.map((step, i) => {
          const next = steps[i + 1];
          return (
            <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
              {i < steps.length - 1 ? (
                <span
                  className={`absolute left-[0.6rem] top-8 h-[calc(100%-0.25rem)] w-0.5 ${lineClass(step, next)}`}
                  aria-hidden
                />
              ) : null}
              <div className="relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-[0.65rem] font-bold leading-none ${dotClass(step.dot)}`}
                  aria-hidden
                >
                  {step.dot === "complete" ? "\u2713" : ""}
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-0">
                <p className="text-[1.2rem] font-semibold text-brand-navy">{step.title}</p>
                <p className="mt-1 text-[1.05rem] leading-snug text-brand-navy/75">{step.subtitle}</p>
                {step.key === "dispatch" &&
                payload.status === "shipped" &&
                payload.tracking_number?.trim() ? (
                  <p className="mt-2 text-[1.05rem] text-brand-navy/80">
                    <span className="text-brand-navy/65">{payload.carrier} tracking: </span>
                    <span className="font-mono font-semibold">{payload.tracking_number}</span>
                  </p>
                ) : null}
                {step.key === "dispatch" && ausPostUrl ? (
                  <p className="mt-2">
                    <Link href={ausPostUrl} className="text-[1.05rem] font-semibold text-brand-orange hover:underline">
                      Track on Australia Post
                    </Link>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

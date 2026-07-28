"use client";

import { useEffect, useState, useTransition } from "react";

import { updateDispatchOrderCarrierAndTracking } from "./actions";
import { DISPATCH_CARRIER_OPTIONS, normalizeDispatchCarrierOption } from "./dispatch-carrier";

type Props = {
  storeOrderId: string;
  initialCarrier: string;
  initialTrackingNumber: string | null;
};

export function DispatchCarrierCell({ storeOrderId, initialCarrier, initialTrackingNumber }: Props) {
  const [carrier, setCarrier] = useState(() => normalizeDispatchCarrierOption(initialCarrier));
  const [trackingNumber, setTrackingNumber] = useState(() => (initialTrackingNumber ?? "").trim());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCarrier(normalizeDispatchCarrierOption(initialCarrier));
    setTrackingNumber((initialTrackingNumber ?? "").trim());
  }, [initialCarrier, initialTrackingNumber, storeOrderId]);

  function save(nextCarrier: string, nextTracking: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateDispatchOrderCarrierAndTracking({
        storeOrderId,
        carrier: nextCarrier,
        trackingNumber: nextTracking,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Saved");
      window.setTimeout(() => setMessage(null), 2000);
    });
  }

  return (
    <div className="min-w-[12rem] max-w-[16rem] space-y-2">
      <label className="block space-y-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Carrier</span>
        <select
          value={carrier}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            setCarrier(next);
            save(next, trackingNumber);
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-brand-navy focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange disabled:opacity-60"
        >
          <option value="">Select…</option>
          {DISPATCH_CARRIER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
          Tracking number
        </span>
        <input
          type="text"
          value={trackingNumber}
          disabled={pending}
          placeholder="Enter tracking no."
          autoComplete="off"
          data-latin-mode="ascii"
          inputMode="text"
          onChange={(e) => setTrackingNumber(e.target.value)}
          onBlur={() => {
            save(carrier, trackingNumber.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-brand-navy placeholder:text-slate-400 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange disabled:opacity-60"
        />
      </label>
      {pending ? <p className="text-[0.65rem] text-slate-500">Saving…</p> : null}
      {message ? (
        <p className={`text-[0.65rem] ${message === "Saved" ? "text-emerald-700" : "text-red-700"}`}>{message}</p>
      ) : null}
    </div>
  );
}

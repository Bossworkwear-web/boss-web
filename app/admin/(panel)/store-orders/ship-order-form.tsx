"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markStoreOrderShipped } from "@/app/admin/(panel)/store-orders/actions";

export function ShipOrderForm({
  orderId,
  alreadyShipped,
  existingTracking,
}: {
  orderId: string;
  alreadyShipped: boolean;
  existingTracking: string | null;
}) {
  const router = useRouter();
  const [tracking, setTracking] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (alreadyShipped && existingTracking) {
    return (
      <p className="text-sm">
        <span className="text-slate-500">Tracking: </span>
        <span className="font-mono font-semibold">{existingTracking}</span>
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const res = await markStoreOrderShipped(orderId, tracking);
          if (res.ok) {
            setTracking("");
            setMessage("Customer emailed.");
            router.refresh();
          } else {
            setMessage(res.error);
          }
        });
      }}
    >
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor={`track-${orderId}`}>
          Australia Post tracking number
        </label>
        <input
          id={`track-${orderId}`}
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Aus Post tracking #"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={pending}
        />
      </div>
      <button
        type="submit"
        disabled={pending || !tracking.trim()}
        className="shrink-0 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Mark shipped"}
      </button>
      {message ? <p className="text-xs text-slate-600 sm:w-full sm:basis-full">{message}</p> : null}
    </form>
  );
}

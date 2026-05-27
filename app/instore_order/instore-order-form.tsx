"use client";

import { useMemo, useState, useTransition } from "react";

import { createInstoreWalkInOrder } from "@/app/instore_order/actions";
import {
  INSTORE_WALK_IN_PICKUP_ADDRESS,
  INSTORE_WALK_IN_SERVICE_TYPES,
} from "@/lib/instore-walk-in-constants";

type LineDraft = {
  description: string;
  service: string;
  color: string;
  size: string;
  qty: string;
  unitAud: string;
  notes: string;
};

function emptyLine(): LineDraft {
  return {
    description: "",
    service: "Embroidery",
    color: "",
    size: "",
    qty: "1",
    unitAud: "",
    notes: "",
  };
}

const inputClass =
  "w-full rounded-lg border border-brand-navy/20 px-3 py-2 text-sm text-brand-navy focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";

export function InstoreOrderForm() {
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);
  const [pickup, setPickup] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const lineCount = lines.length;

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const estimatedTotalAud = useMemo(() => {
    let cents = 0;
    for (const line of lines) {
      const unit = Number.parseFloat(line.unitAud.replace(/,/g, "").trim());
      const qty = Number.parseInt(line.qty, 10);
      if (Number.isFinite(unit) && unit >= 0 && Number.isFinite(qty) && qty > 0) {
        cents += Math.round(unit * 100) * qty;
      }
    }
    return cents / 100;
  }, [lines]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("line_count", String(lineCount));
    fd.set("fulfilment", pickup ? "pickup" : "delivery");
    if (!pickup) {
      fd.set("delivery_address", deliveryAddress);
    }
    lines.forEach((line, i) => {
      fd.set(`line_${i}_description`, line.description);
      fd.set(`line_${i}_service`, line.service);
      fd.set(`line_${i}_color`, line.color);
      fd.set(`line_${i}_size`, line.size);
      fd.set(`line_${i}_qty`, line.qty);
      fd.set(`line_${i}_unit_aud`, line.unitAud);
      fd.set(`line_${i}_notes`, line.notes);
    });
    startTransition(async () => {
      await createInstoreWalkInOrder(fd);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="rounded-2xl border border-brand-navy/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Customer</h2>
        <p className="mt-1 text-sm text-brand-navy/65">
          Walk-in customer details. Email or phone is required (phone-only uses an internal email for the order record).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-brand-navy">Name *</span>
            <input name="customer_name" required className={`${inputClass} mt-1`} autoComplete="name" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-brand-navy">Email</span>
            <input name="customer_email" type="email" className={`${inputClass} mt-1`} autoComplete="email" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-brand-navy">Phone</span>
            <input name="customer_phone" type="tel" className={`${inputClass} mt-1`} autoComplete="tel" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-brand-navy">Due date (optional)</span>
            <input name="due_date" type="date" className={`${inputClass} mt-1`} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Garments &amp; services</h2>
        <p className="mt-1 text-sm text-brand-navy/65">
          One row per item the customer brought in (polo, cap, jacket, etc.) and the printing or embroidery work required.
        </p>
        <div className="mt-4 space-y-6">
          {lines.map((line, index) => (
            <div
              key={index}
              className="rounded-xl border border-brand-navy/10 bg-brand-surface/30 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand-navy">Item {index + 1}</p>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="text-xs font-semibold text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-brand-navy/80">Description *</span>
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(index, { description: e.target.value })}
                    placeholder="e.g. Customer navy polo — logo left chest"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Service</span>
                  <select
                    value={line.service}
                    onChange={(e) => updateLine(index, { service: e.target.value })}
                    className={`${inputClass} mt-1`}
                  >
                    {INSTORE_WALK_IN_SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Colour</span>
                  <input
                    value={line.color}
                    onChange={(e) => updateLine(index, { color: e.target.value })}
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Size</span>
                  <input
                    value={line.size}
                    onChange={(e) => updateLine(index, { size: e.target.value })}
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Qty</span>
                  <input
                    value={line.qty}
                    onChange={(e) => updateLine(index, { qty: e.target.value })}
                    inputMode="numeric"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Price each (AUD)</span>
                  <input
                    value={line.unitAud}
                    onChange={(e) => updateLine(index, { unitAud: e.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-brand-navy/80">Work notes</span>
                  <input
                    value={line.notes}
                    onChange={(e) => updateLine(index, { notes: e.target.value })}
                    placeholder="Logo file, placement, thread colours…"
                    className={`${inputClass} mt-1`}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-4 rounded-lg border border-brand-navy/20 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-surface/80"
        >
          + Add another item
        </button>
        <p className="mt-4 text-sm text-brand-navy/70">
          Estimated total:{" "}
          <span className="font-semibold tabular-nums text-brand-navy">
            ${estimatedTotalAud.toFixed(2)} AUD
          </span>
        </p>
      </section>

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Collection</h2>
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="fulfilment_choice"
              checked={pickup}
              onChange={() => setPickup(true)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold text-brand-navy">Pick up in store</span>
              <span className="mt-0.5 block text-xs text-brand-navy/60">{INSTORE_WALK_IN_PICKUP_ADDRESS}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="fulfilment_choice"
              checked={!pickup}
              onChange={() => setPickup(false)}
              className="mt-1"
            />
            <span className="font-semibold text-brand-navy">Deliver / ship later</span>
          </label>
          {!pickup ? (
            <label className="block">
              <span className="text-xs font-semibold text-brand-navy/80">Delivery address</span>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={3}
                className={`${inputClass} mt-1`}
                placeholder="Customer delivery address"
              />
            </label>
          ) : null}
        </div>
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-brand-navy">Order notes (optional)</span>
          <textarea name="order_notes" rows={2} className={`${inputClass} mt-1`} />
        </label>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand-orange px-4 py-3 text-base font-semibold text-brand-navy transition hover:brightness-95 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save instore order"}
      </button>
    </form>
  );
}

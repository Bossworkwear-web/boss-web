"use client";

import { useMemo, useState } from "react";

import { CalculatorIcon } from "@/app/components/icons";
import {
  EMBROIDERY_CALCULATOR_ROWS,
  embroideryLineGross,
  embroideryLineNetAfterDiscount,
  embroideryQtyDiscountRate,
  type EmbroideryCalculatorRowId,
} from "@/lib/embroidery-calculator-rows";

function formatMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function parseQty(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function labelForId(id: EmbroideryCalculatorRowId): string {
  return EMBROIDERY_CALCULATOR_ROWS.find((r) => r.id === id)?.label ?? id;
}

function defaultUnitForId(id: EmbroideryCalculatorRowId): number {
  return EMBROIDERY_CALCULATOR_ROWS.find((r) => r.id === id)?.defaultUnitPrice ?? 0;
}

type Line = {
  id: EmbroideryCalculatorRowId;
  unit: number;
  qty: number;
};

type EmbroideryPriceCalculatorProps = {
  className?: string;
  embed?: boolean;
};

export function EmbroideryPriceCalculator({ className = "", embed = false }: EmbroideryPriceCalculatorProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedId, setSelectedId] = useState<EmbroideryCalculatorRowId | "">("");
  const [draftQtyStr, setDraftQtyStr] = useState("");

  const draftUnit = useMemo(
    () => (selectedId ? defaultUnitForId(selectedId) : 0),
    [selectedId],
  );
  const draftQty = useMemo(() => parseQty(draftQtyStr), [draftQtyStr]);
  const draftGross = useMemo(() => embroideryLineGross(draftUnit, draftQty), [draftUnit, draftQty]);
  const draftDiscountRate = useMemo(() => embroideryQtyDiscountRate(draftQty), [draftQty]);
  const draftSubtotal = useMemo(
    () => embroideryLineNetAfterDiscount(draftUnit, draftQty),
    [draftUnit, draftQty],
  );

  const totals = useMemo(
    () => lines.reduce((s, l) => s + embroideryLineNetAfterDiscount(l.unit, l.qty), 0),
    [lines],
  );

  function onSelectItem(id: string) {
    if (id === "") {
      setSelectedId("");
      setDraftQtyStr("");
      return;
    }
    const rowId = id as EmbroideryCalculatorRowId;
    setSelectedId(rowId);
    setDraftQtyStr("5");
  }

  function addLine() {
    if (!selectedId || draftQty <= 0) {
      return;
    }
    const unit = defaultUnitForId(selectedId);
    setLines((prev) => [...prev, { id: selectedId, unit, qty: draftQty }]);
    setDraftQtyStr("5");
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setLines([]);
    setSelectedId("");
    setDraftQtyStr("");
  }

  const fieldText = embed ? "text-[0.975rem] sm:text-[1.125rem]" : "text-sm";
  const labelText = embed ? "text-[0.975rem] font-semibold sm:text-[1.125rem]" : "text-xs font-semibold";
  const inputClass = `w-full rounded-lg border border-orange-200/90 bg-white tabular-nums text-slate-800 shadow-sm focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/35 ${embed ? "px-3 py-2" : "px-3 py-2"} ${fieldText}`;

  return (
    <section
      className={
        embed
          ? `relative min-w-0 ${className}`.trim()
          : `relative mb-12 overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-gradient-to-b from-white via-brand-surface/30 to-white px-4 py-8 shadow-[0_16px_44px_-12px_rgba(0,31,63,0.1)] sm:px-6 sm:py-10 ${className}`.trim()
      }
      aria-labelledby="embroidery-calculator-heading"
    >
      {!embed ? (
        <div
          className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-brand-orange/10 blur-2xl"
          aria-hidden
        />
      ) : null}

      <div
        className={`relative flex flex-col gap-3 ${embed ? "mb-4" : "mb-6"} sm:flex-row sm:items-start sm:justify-between`}
      >
        <div className="flex items-start gap-2 sm:gap-3">
          <span
            className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-2xl bg-brand-orange text-brand-navy shadow-md ring-2 ring-brand-orange/35 ${embed ? "h-[3.375rem] w-[3.375rem]" : "h-11 w-11"}`}
          >
            <CalculatorIcon className={embed ? "h-[1.875rem] w-[1.875rem]" : "h-6 w-6"} />
          </span>
          <div className="min-w-0">
            <h2
              id="embroidery-calculator-heading"
              className={`font-semibold tracking-tight text-brand-orange ${embed ? "text-[1.5rem] sm:text-[1.6875rem]" : "text-2xl sm:text-3xl"}`}
            >
              Embroidery price Calculator
            </h2>
            <p
              className={`mt-1 leading-relaxed text-slate-600 ${embed ? "text-[0.975rem] sm:text-[1.125rem]" : "max-w-xl text-sm"}`}
            >
              Choose an item from the dropdown, set quantity, then add lines to build your
              estimate. Volume discounts per line: 10+ units 5% off, 20+ units 10% off, 50+ units 15% off, 100+
              units 20% off.
              Confirm final pricing in store.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className={`shrink-0 self-start rounded-xl border border-orange-300/80 bg-white font-semibold text-orange-900 transition hover:border-brand-orange hover:bg-orange-50/90 ${embed ? "px-3 py-2 text-[1.125rem]" : "px-4 py-2 text-sm"}`}
        >
          Reset
        </button>
      </div>

      <div className="space-y-4 rounded-2xl border border-orange-200/70 bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end lg:gap-3">
          <div className="sm:col-span-2 lg:col-span-5">
            <label htmlFor="embroidery-item-select" className={`mb-1 block uppercase tracking-wide text-orange-900/85 ${labelText}`}>
              Item
            </label>
            <select
              id="embroidery-item-select"
              value={selectedId}
              onChange={(e) => onSelectItem(e.target.value)}
              className={`${inputClass} cursor-pointer appearance-none bg-no-repeat pr-9 ${embed ? "bg-[length:1.5rem] bg-[right_0.625rem_center]" : "bg-[length:1rem] bg-[right_0.5rem_center]"}`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ff851b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m19 9-7 7-7-7'/%3E%3C/svg%3E")`,
              }}
            >
              <option value="">Select an item…</option>
              {EMBROIDERY_CALCULATOR_ROWS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <p id="embroidery-unit-label" className={`mb-1 uppercase tracking-wide text-orange-900/85 ${labelText}`}>
              PRICE EACH ($)
            </p>
            <div
              id="embroidery-unit-display"
              role="status"
              aria-labelledby="embroidery-unit-label"
              className={`flex min-h-[2.75rem] w-full items-center rounded-lg border border-orange-200/90 bg-orange-50/70 px-3 py-2 tabular-nums text-slate-900 ${fieldText} ${!selectedId ? "text-slate-400" : "font-semibold"}`}
            >
              {selectedId ? formatMoney(draftUnit) : "—"}
            </div>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="embroidery-qty-input" className={`mb-1 block uppercase tracking-wide text-orange-900/85 ${labelText}`}>
              Qty
            </label>
            <input
              id="embroidery-qty-input"
              type="number"
              min={0}
              step={1}
              disabled={!selectedId}
              value={draftQtyStr}
              placeholder="5"
              onChange={(e) => setDraftQtyStr(e.target.value)}
              className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-2">
            <p className={`${labelText} text-orange-900/85`}>Line subtotal</p>
            <div className={`rounded-lg border border-orange-100 bg-orange-50/40 px-3 py-2 ${fieldText}`}>
              {draftDiscountRate > 0 && draftGross > 0 ? (
                <p className="tabular-nums text-slate-500 line-through">{formatMoney(draftGross)}</p>
              ) : null}
              <p className="font-semibold tabular-nums text-slate-900">{formatMoney(draftSubtotal)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addLine}
            disabled={!selectedId || draftQty <= 0}
            className={`rounded-xl bg-brand-orange font-semibold text-brand-navy shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 ${embed ? "px-5 py-2.5 text-[1.3125rem]" : "px-4 py-2 text-sm"}`}
          >
            Add to estimate
          </button>
          {draftDiscountRate > 0 ? (
            <span className={`max-w-[min(100%,24rem)] font-medium text-brand-orange ${fieldText}`}>
              {Math.round(draftDiscountRate * 100)}% qty discount applied
            </span>
          ) : null}
          {!selectedId ? (
            <span className={`text-slate-500 ${fieldText}`}>Select an item to continue.</span>
          ) : draftQty <= 0 ? (
            <span className={`text-slate-500 ${fieldText}`}>Enter a quantity of at least 1.</span>
          ) : null}
        </div>

        {lines.length > 0 ? (
          <div className="border-t border-orange-200/70 pt-4">
            <p className={`mb-2 font-semibold uppercase tracking-wide text-orange-900/90 ${labelText}`}>
              Your lines
            </p>
            <ul className={`divide-y divide-orange-100 rounded-xl border border-orange-200/60 bg-white ${fieldText}`}>
              {lines.map((line, index) => {
                const gross = embroideryLineGross(line.unit, line.qty);
                const net = embroideryLineNetAfterDiscount(line.unit, line.qty);
                const rate = embroideryQtyDiscountRate(line.qty);
                return (
                <li
                  key={`${line.id}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:flex-nowrap sm:px-4"
                >
                  <span className="min-w-0 flex-1 font-medium text-slate-800 [overflow-wrap:anywhere]">
                    {labelForId(line.id)}
                  </span>
                  <span className="tabular-nums text-slate-700">
                    {line.qty} × {formatMoney(line.unit)}
                    {rate > 0 ? (
                      <span className="text-brand-orange"> ({Math.round(rate * 100)}% off)</span>
                    ) : null}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-slate-900">
                    {rate > 0 ? (
                      <span className="mr-1.5 text-slate-400 line-through">{formatMoney(gross)}</span>
                    ) : null}
                    {formatMoney(net)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className={`shrink-0 rounded-lg border border-orange-200 font-semibold text-orange-900 transition hover:border-brand-orange hover:bg-orange-50/80 ${embed ? "px-2.5 py-1.5 text-[1.125rem]" : "px-2 py-1 text-xs"}`}
                  >
                    Remove
                  </button>
                </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-200/70 pt-4">
          <span className={`font-semibold uppercase tracking-wide text-orange-900/90 ${embed ? "text-[1.125rem]" : "text-sm"}`}>
            Total
          </span>
          <span className={`font-bold tabular-nums text-brand-orange ${embed ? "text-[1.5rem] sm:text-[1.875rem]" : "text-xl"}`}>
            {formatMoney(totals)}
          </span>
        </div>
      </div>

      <p
        className={`mt-3 text-slate-600 ${embed ? "text-[0.9rem] leading-snug sm:text-[0.975rem]" : "text-xs leading-relaxed sm:text-sm"}`}
      >
        *<strong>Minimum</strong> is 5 unit and more.
      </p>
      <p
        className={`mt-2 text-slate-600 ${embed ? "text-[0.9rem] leading-snug sm:text-[0.975rem]" : "text-xs leading-relaxed sm:text-sm"}`}
      >
        *<strong>First time</strong> Logo Set up fee of $66 will be applied for each company logo
      </p>
      <p
        className={`mt-2 text-slate-500 ${embed ? "text-[0.9rem] leading-snug sm:text-[0.975rem]" : "text-xs leading-relaxed sm:text-sm"}`}
      >
        *This is only an estimate, and price might be different depending on size, number of colours, and thread
        count.
      </p>
    </section>
  );
}

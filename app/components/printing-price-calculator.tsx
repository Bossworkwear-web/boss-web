"use client";

import { useMemo, useState } from "react";

import { CalculatorIcon } from "@/app/components/icons";
import {
  PRINTING_CALCULATOR_ROWS,
  printingLineGross,
  printingLineNetAfterDiscount,
  printingMinQtyForId,
  printingQtyDiscountRate,
  type PrintingCalculatorRowId,
} from "@/lib/printing-calculator-rows";

function formatMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function parseQty(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function labelForId(id: PrintingCalculatorRowId): string {
  return PRINTING_CALCULATOR_ROWS.find((r) => r.id === id)?.label ?? id;
}

function defaultUnitForId(id: PrintingCalculatorRowId): number {
  return PRINTING_CALCULATOR_ROWS.find((r) => r.id === id)?.defaultUnitPrice ?? 0;
}

type Line = {
  id: PrintingCalculatorRowId;
  unit: number;
  qty: number;
};

type PrintingPriceCalculatorProps = {
  className?: string;
  embed?: boolean;
};

export function PrintingPriceCalculator({ className = "", embed = false }: PrintingPriceCalculatorProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedId, setSelectedId] = useState<PrintingCalculatorRowId | "">("");
  const [draftQtyStr, setDraftQtyStr] = useState("");

  const draftUnit = useMemo(() => (selectedId ? defaultUnitForId(selectedId) : 0), [selectedId]);
  const draftQty = useMemo(() => parseQty(draftQtyStr), [draftQtyStr]);
  const draftGross = useMemo(() => printingLineGross(draftUnit, draftQty), [draftUnit, draftQty]);
  const draftDiscountRate = useMemo(
    () => (selectedId ? printingQtyDiscountRate(selectedId, draftQty) : 0),
    [selectedId, draftQty],
  );
  const draftSubtotal = useMemo(
    () => (selectedId ? printingLineNetAfterDiscount(draftUnit, draftQty, selectedId) : 0),
    [draftUnit, draftQty, selectedId],
  );

  const totals = useMemo(
    () => lines.reduce((s, l) => s + printingLineNetAfterDiscount(l.unit, l.qty, l.id), 0),
    [lines],
  );

  const draftMinQty = useMemo(
    () => (selectedId ? printingMinQtyForId(selectedId) : 0),
    [selectedId],
  );
  const draftMeetsMinimum = !selectedId || draftQty >= draftMinQty;

  function onSelectItem(id: string) {
    if (id === "") {
      setSelectedId("");
      setDraftQtyStr("");
      return;
    }
    const rowId = id as PrintingCalculatorRowId;
    setSelectedId(rowId);
    setDraftQtyStr(String(printingMinQtyForId(rowId)));
  }

  function addLine() {
    if (!selectedId || draftQty < printingMinQtyForId(selectedId)) {
      return;
    }
    const unit = defaultUnitForId(selectedId);
    setLines((prev) => [...prev, { id: selectedId, unit, qty: draftQty }]);
    setDraftQtyStr(String(printingMinQtyForId(selectedId)));
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
  const inputClass = `w-full rounded-lg border border-brand-navy/15 bg-white tabular-nums text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange ${embed ? "px-3 py-2" : "px-3 py-2"} ${fieldText}`;

  return (
    <section
      className={
        embed
          ? `relative min-w-0 ${className}`.trim()
          : `relative mb-12 overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-gradient-to-b from-white via-brand-surface/30 to-white px-4 py-8 shadow-[0_16px_44px_-12px_rgba(0,31,63,0.1)] sm:px-6 sm:py-10 ${className}`.trim()
      }
      aria-labelledby="printing-calculator-heading"
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
            className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-2xl bg-brand-navy text-white shadow-sm ${embed ? "h-[3.375rem] w-[3.375rem]" : "h-11 w-11"}`}
          >
            <CalculatorIcon className={embed ? "h-[1.875rem] w-[1.875rem]" : "h-6 w-6"} />
          </span>
          <div className="min-w-0">
            <h2
              id="printing-calculator-heading"
              className={`font-semibold tracking-tight text-brand-navy ${embed ? "text-[1.5rem] sm:text-[1.6875rem]" : "text-2xl sm:text-3xl"}`}
            >
              Printing price Calculator
            </h2>
            <p
              className={`mt-1 leading-relaxed text-brand-navy/70 ${embed ? "text-[0.975rem] sm:text-[1.125rem]" : "max-w-xl text-sm"}`}
            >
              Choose an item from the dropdown, set quantity, then add lines to build your
              estimate. Volume discounts per line: 10+ units 10% off, 20+ units 15% off, 50+ units 20% off, 100+
              units 30% off.
              Confirm final pricing in store.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className={`shrink-0 self-start rounded-xl border border-brand-navy/15 bg-white font-semibold text-brand-navy transition hover:border-brand-orange/40 hover:bg-brand-surface ${embed ? "px-3 py-2 text-[1.125rem]" : "px-4 py-2 text-sm"}`}
        >
          Reset
        </button>
      </div>

      <div className="space-y-4 rounded-2xl border border-brand-navy/10 bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end lg:gap-3">
          <div className="sm:col-span-2 lg:col-span-5">
            <label htmlFor="printing-item-select" className={`mb-1 block uppercase tracking-wide text-brand-navy/75 ${labelText}`}>
              Item
            </label>
            <select
              id="printing-item-select"
              value={selectedId}
              onChange={(e) => onSelectItem(e.target.value)}
              className={`${inputClass} cursor-pointer appearance-none bg-no-repeat pr-9 ${embed ? "bg-[length:1.5rem] bg-[right_0.625rem_center]" : "bg-[length:1rem] bg-[right_0.5rem_center]"}`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23001f3f'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m19 9-7 7-7-7'/%3E%3C/svg%3E")`,
              }}
            >
              <option value="">Select an item…</option>
              {PRINTING_CALCULATOR_ROWS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <p id="printing-unit-label" className={`mb-1 uppercase tracking-wide text-brand-navy/75 ${labelText}`}>
              PRICE EACH ($)
            </p>
            <div
              id="printing-unit-display"
              role="status"
              aria-labelledby="printing-unit-label"
              className={`flex min-h-[2.75rem] w-full items-center rounded-lg border border-brand-navy/15 bg-brand-surface/90 px-3 py-2 tabular-nums text-brand-navy ${fieldText} ${!selectedId ? "text-brand-navy/45" : "font-semibold"}`}
            >
              {selectedId ? formatMoney(draftUnit) : "—"}
            </div>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="printing-qty-input" className={`mb-1 block uppercase tracking-wide text-brand-navy/75 ${labelText}`}>
              Qty
            </label>
            <input
              id="printing-qty-input"
              type="number"
              min={selectedId ? printingMinQtyForId(selectedId) : 0}
              step={1}
              disabled={!selectedId}
              value={draftQtyStr}
              placeholder={selectedId ? String(printingMinQtyForId(selectedId)) : "—"}
              onChange={(e) => setDraftQtyStr(e.target.value)}
              className={`${inputClass} disabled:cursor-not-allowed disabled:bg-brand-surface/80 disabled:text-brand-navy/45`}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-2">
            <p className={`${labelText} text-brand-navy/75`}>Line subtotal</p>
            <div className={`rounded-lg border border-brand-navy/10 bg-brand-surface/50 px-3 py-2 ${fieldText}`}>
              {draftDiscountRate > 0 && draftGross > 0 ? (
                <p className="tabular-nums text-brand-navy/65 line-through">{formatMoney(draftGross)}</p>
              ) : null}
              <p className="font-semibold tabular-nums text-brand-navy">{formatMoney(draftSubtotal)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addLine}
            disabled={!selectedId || !draftMeetsMinimum}
            className={`rounded-xl bg-brand-navy font-semibold text-white transition hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-45 ${embed ? "px-5 py-2.5 text-[1.3125rem]" : "px-4 py-2 text-sm"}`}
          >
            Add to estimate
          </button>
          {draftDiscountRate > 0 ? (
            <span className={`max-w-[min(100%,24rem)] font-medium text-brand-orange ${fieldText}`}>
              {Math.round(draftDiscountRate * 100)}% qty discount applied
            </span>
          ) : null}
          {!selectedId ? (
            <span className={`text-brand-navy/55 ${fieldText}`}>Select an item to continue.</span>
          ) : !draftMeetsMinimum ? (
            <span className={`text-brand-navy/55 ${fieldText}`}>
              Minimum order for {labelForId(selectedId)} is {draftMinQty} units.
            </span>
          ) : null}
        </div>

        {lines.length > 0 ? (
          <div className="border-t border-brand-navy/10 pt-4">
            <p className={`mb-2 font-semibold uppercase tracking-wide text-brand-navy/80 ${labelText}`}>
              Your lines
            </p>
            <ul className={`divide-y divide-brand-navy/10 rounded-xl border border-brand-navy/10 bg-white ${fieldText}`}>
              {lines.map((line, index) => {
                const gross = printingLineGross(line.unit, line.qty);
                const net = printingLineNetAfterDiscount(line.unit, line.qty, line.id);
                const rate = printingQtyDiscountRate(line.id, line.qty);
                return (
                  <li
                    key={`${line.id}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:flex-nowrap sm:px-4"
                  >
                    <span className="min-w-0 flex-1 font-medium text-brand-navy [overflow-wrap:anywhere]">
                      {labelForId(line.id)}
                    </span>
                    <span className="tabular-nums text-brand-navy/80">
                      {line.qty} × {formatMoney(line.unit)}
                      {rate > 0 ? (
                        <span className="text-brand-orange"> ({Math.round(rate * 100)}% off)</span>
                      ) : null}
                    </span>
                    <span className="text-right font-semibold tabular-nums text-brand-navy">
                      {rate > 0 ? (
                        <span className="mr-1.5 text-brand-navy/50 line-through">{formatMoney(gross)}</span>
                      ) : null}
                      {formatMoney(net)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className={`shrink-0 rounded-lg border border-brand-navy/15 font-semibold text-brand-navy transition hover:border-brand-orange/50 hover:bg-brand-surface ${embed ? "px-2.5 py-1.5 text-[1.125rem]" : "px-2 py-1 text-xs"}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-navy/10 pt-4">
          <span className={`font-semibold uppercase tracking-wide text-brand-navy/80 ${embed ? "text-[1.125rem]" : "text-sm"}`}>
            Total
          </span>
          <span className={`font-bold tabular-nums text-brand-navy ${embed ? "text-[1.5rem] sm:text-[1.875rem]" : "text-xl"}`}>
            {formatMoney(totals)}
          </span>
        </div>
      </div>

      <p
        className={`mt-3 text-brand-navy/70 ${embed ? "text-[0.9rem] leading-snug sm:text-[0.975rem]" : "text-xs leading-relaxed sm:text-sm"}`}
      >
        *<strong>Minimum order:</strong> Company Logo 5 units; A6 Size 4; A5 Size 4; A4 Size 2; A3 Size 1.
      </p>
      <p
        className={`mt-2 text-brand-navy/60 ${embed ? "text-[0.9rem] leading-snug sm:text-[0.975rem]" : "text-xs leading-relaxed sm:text-sm"}`}
      >
        *This is only an estimate, and price might be different depending on artwork, colours, and material.
      </p>
    </section>
  );
}

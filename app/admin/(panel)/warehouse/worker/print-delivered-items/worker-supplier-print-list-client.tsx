"use client";

import { useEffect, useMemo, useState } from "react";

import type { Database } from "@/lib/database.types";
import { ADMIN_SUPPLIER_ORDER_SHEET_DAY_WINDOW } from "@/lib/load-admin-supplier-order-sheets";
import {
  formatSupplierOrderSheetListDateTitle,
  printSupplierOrderDaySheet,
} from "@/lib/supplier-order-sheet-print";

type SupplierOrderLineRow = Database["public"]["Tables"]["supplier_order_lines"]["Row"];

const SHEETS_PER_PAGE = 7;

type Props = {
  sheetDates: string[];
  linesByDate: Record<string, SupplierOrderLineRow[]>;
  productImageByProductKey: Record<string, string | null>;
  migrationHint: string | null;
  pageOpenedLabel: string;
  pageOpenedIso: string;
};

function PaginationBar(props: {
  page: number;
  totalPages: number;
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  disabledPrev: boolean;
  disabledNext: boolean;
}) {
  const { page, totalPages, rangeLabel, onPrev, onNext, disabledPrev, disabledNext } = props;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-sm text-slate-700">
        <span className="font-semibold text-brand-navy">
          Page {page} / {totalPages}
        </span>
        <span className="mx-2 text-slate-300">·</span>
        <span className="text-slate-600">{rangeLabel}</span>
        <span className="ml-2 text-xs text-slate-500">({SHEETS_PER_PAGE} dates per page)</span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={disabledPrev}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disabledNext}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function WorkerSupplierPrintListClient({
  sheetDates,
  linesByDate,
  productImageByProductKey,
  migrationHint,
  pageOpenedLabel,
  pageOpenedIso,
}: Props) {
  const [sheetDateFilter, setSheetDateFilter] = useState("");
  const [page, setPage] = useState(1);

  const effectiveDates = useMemo(() => {
    if (!sheetDateFilter) return sheetDates;
    return sheetDates.filter((ymd) => ymd === sheetDateFilter);
  }, [sheetDates, sheetDateFilter]);

  const totalPages = Math.max(1, Math.ceil(effectiveDates.length / SHEETS_PER_PAGE));

  useEffect(() => {
    setPage(1);
  }, [sheetDateFilter]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const visibleDates = useMemo(() => {
    const start = (page - 1) * SHEETS_PER_PAGE;
    return effectiveDates.slice(start, start + SHEETS_PER_PAGE);
  }, [effectiveDates, page]);

  const rangeLabel = useMemo(() => {
    if (visibleDates.length === 0) return "—";
    const first = visibleDates[0]!;
    const last = visibleDates[visibleDates.length - 1]!;
    if (first === last) return first;
    return `${last} → ${first}`;
  }, [visibleDates]);

  const hasDateFilter = sheetDateFilter.length > 0;
  const noSheetForDate = hasDateFilter && effectiveDates.length === 0;

  return (
    <div className="space-y-8">
      {migrationHint ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong className="font-semibold">Database setup</strong>
          <p className="mt-2 whitespace-pre-wrap">{migrationHint}</p>
        </div>
      ) : null}

      <p className="text-sm text-slate-600">
        Showing the last <strong>{sheetDates.length}</strong> Perth calendar days (same window as Admin → Supplier
        orders). Each card is one daily worksheet — use <strong>Print sheet</strong> for the same table layout as the
        main Supplier orders page.
      </p>
      <p className="text-xs text-slate-500">
        Page opened:{" "}
        <time dateTime={pageOpenedIso} className="text-slate-600">
          {pageOpenedLabel}
        </time>
      </p>

      <div className="w-full space-y-2">
        <label htmlFor="worker-supplier-sheet-date" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Jump to date
        </label>
        <div className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="worker-supplier-sheet-date"
            type="date"
            value={sheetDateFilter}
            onChange={(e) => setSheetDateFilter(e.target.value)}
            className="min-h-[48px] w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
          {hasDateFilter ? (
            <button
              type="button"
              onClick={() => setSheetDateFilter("")}
              className="shrink-0 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-brand-navy hover:bg-slate-50"
            >
              Show all dates
            </button>
          ) : null}
        </div>
      </div>

      {noSheetForDate ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
          No worksheet for <strong className="text-brand-navy">{sheetDateFilter}</strong> in this list (only the last{" "}
          {ADMIN_SUPPLIER_ORDER_SHEET_DAY_WINDOW} Perth days are loaded).
        </div>
      ) : (
        <>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            rangeLabel={rangeLabel}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabledPrev={page <= 1}
            disabledNext={page >= totalPages}
          />

          <ul className="space-y-4">
            {visibleDates.map((ymd) => {
              const lines = linesByDate[ymd] ?? [];
              const n = lines.length;
              return (
                <li
                  key={ymd}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-brand-navy">{formatSupplierOrderSheetListDateTitle(ymd)}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                      {ymd} · {n === 0 ? "No lines" : `${n} line${n === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => printSupplierOrderDaySheet(ymd, lines, productImageByProductKey)}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-brand-navy transition hover:bg-slate-50"
                  >
                    Print sheet
                  </button>
                </li>
              );
            })}
          </ul>

          <PaginationBar
            page={page}
            totalPages={totalPages}
            rangeLabel={rangeLabel}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabledPrev={page <= 1}
            disabledNext={page >= totalPages}
          />
        </>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { Database } from "@/lib/database.types";
import {
  formatSupplierOrderSheetListDateTitle,
  printSupplierOrderDaySheet,
} from "@/lib/supplier-order-sheet-print";

import { SupplierDayOrderTable } from "./supplier-order-lines-table";

const SHEETS_PER_PAGE = 7;

type SupplierOrderLineRow = Database["public"]["Tables"]["supplier_order_lines"]["Row"];

type Props = {
  sheetDates: string[];
  linesByDate: Record<string, SupplierOrderLineRow[]>;
  migrationHint: string | null;
  /** From Completed Order → Pre-process documents links. */
  completeOrdersDocumentsView?: boolean;
  /** From Dashboard → Warehouse → Manager → Supplier orders (print / view only). */
  warehouseManagerView?: boolean;
  /** Perth worksheet dates marked “Ready for Processing” (Click Up). */
  readyByDate: Record<string, boolean>;
  /** Recent store checkout IDs (`store_orders.order_number`) for supplier-line datalist. */
  storeOrderNumberOptions: string[];
  /** Distinct `products.supplier_name` values for Supplier column datalist. */
  productSupplierNameOptions: string[];
  /** Trimmed `product_id` → first catalog image URL (from `products.image_urls`). */
  productImageByProductKey: Record<string, string | null>;
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
        <span className="ml-2 text-xs text-slate-500">({SHEETS_PER_PAGE} date sheets per page)</span>
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

export function SupplierOrdersByDayClient({
  sheetDates,
  linesByDate,
  migrationHint,
  completeOrdersDocumentsView = false,
  warehouseManagerView = false,
  readyByDate,
  storeOrderNumberOptions,
  productSupplierNameOptions,
  productImageByProductKey,
  pageOpenedLabel,
  pageOpenedIso,
}: Props) {
  const router = useRouter();
  /** YYYY-MM-DD from date input, or "" = show all sheets (paginated). */
  const [sheetDateFilter, setSheetDateFilter] = useState("");
  const [page, setPage] = useState(1);

  /** Near–real-time: RLS blocks anon Realtime on supplier_order_lines; refresh RSC data on an interval + focus. */
  useEffect(() => {
    if (migrationHint || completeOrdersDocumentsView || warehouseManagerView) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const id = window.setInterval(tick, 10_000);
    const onFocus = () => tick();
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, migrationHint, completeOrdersDocumentsView, warehouseManagerView]);

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

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }

  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

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
      {completeOrdersDocumentsView && !migrationHint ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <strong className="font-semibold text-brand-navy">문서 보기 모드</strong>
          <p className="mt-2">
            Completed Order에서 연 Pre-process 링크입니다. 아래 시트는 열람·인쇄만 가능하며, 수정·Ready 토글은
            비활성화됩니다.
          </p>
        </div>
      ) : null}
      {warehouseManagerView && !migrationHint && !completeOrdersDocumentsView ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <strong className="font-semibold text-brand-navy">창고 매니저 보기</strong>
          <p className="mt-2">
            Dashboard → Warehouse → Manager에서 연 화면입니다. 인쇄와 열람만 가능하며, 행 추가·수정·삭제·Ready for
            Processing은 할 수 없습니다. 수정이 필요하면 관리자 메뉴에서 Supplier orders를 직접 여세요.
          </p>
        </div>
      ) : null}

      <p className="text-sm text-slate-600">
        Showing the last <strong>{sheetDates.length}</strong> calendar days in <strong>Australia/Perth</strong>. Each
        screen lists up to <strong>{SHEETS_PER_PAGE}</strong> date sheets; use <strong>Previous</strong> /{" "}
        <strong>Next</strong> to move between pages. Pick a date below to jump to that day&apos;s worksheet only
        (matches the sheet&apos;s <strong>list date</strong>).
      </p>
      <p className="text-xs text-slate-500">
        Page opened:{" "}
        <time dateTime={pageOpenedIso} className="text-slate-600">
          {pageOpenedLabel}
        </time>
      </p>

      <div className="w-full space-y-2">
        <label htmlFor="supplier-order-sheet-date" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Find sheet by date
        </label>
        <div className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="supplier-order-sheet-date"
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
              Show all sheets
            </button>
          ) : null}
        </div>
      </div>

      {noSheetForDate ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
          No worksheet for <strong className="text-brand-navy">{sheetDateFilter}</strong> in this list (only the last{" "}
          {sheetDates.length} Perth calendar days are loaded). Choose another date or tap <strong>Show all sheets</strong>.
        </div>
      ) : (
        <>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            rangeLabel={rangeLabel}
            onPrev={goPrev}
            onNext={goNext}
            disabledPrev={page <= 1}
            disabledNext={page >= totalPages}
          />

          <div className="space-y-8">
            {visibleDates.map((ymd) => {
              const lines = linesByDate[ymd] ?? [];
              return (
                <section key={ymd} aria-labelledby={`supplier-sheet-${ymd}`} className="scroll-mt-4">
                  <SupplierDayOrderTable
                    listDateYmd={ymd}
                    listDateTitle={formatSupplierOrderSheetListDateTitle(ymd)}
                    lines={lines}
                    migrationHint={migrationHint}
                    completeOrdersDocumentsView={completeOrdersDocumentsView}
                    warehouseManagerView={warehouseManagerView}
                    readyForProcessing={Boolean(readyByDate[ymd])}
                    storeOrderNumberOptions={storeOrderNumberOptions}
                    productSupplierNameOptions={productSupplierNameOptions}
                    productImageByProductKey={productImageByProductKey}
                    onPrint={() => printSupplierOrderDaySheet(ymd, lines, productImageByProductKey)}
                  />
                </section>
              );
            })}
          </div>

          <PaginationBar
            page={page}
            totalPages={totalPages}
            rangeLabel={rangeLabel}
            onPrev={goPrev}
            onNext={goNext}
            disabledPrev={page <= 1}
            disabledNext={page >= totalPages}
          />
        </>
      )}
    </div>
  );
}

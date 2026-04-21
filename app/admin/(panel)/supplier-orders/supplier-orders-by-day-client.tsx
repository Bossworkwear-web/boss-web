"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { Database } from "@/lib/database.types";
import { supplierOrderProductIdHeadTail } from "@/lib/supplier-order-product-id-parts";
import { normalizeSupplierOrderLineSupplierValue } from "@/lib/supplier-order-supplier-normalize";

import { SupplierDayOrderTable } from "./supplier-order-lines-table";

const SHEETS_PER_PAGE = 7;

type SupplierOrderLineRow = Database["public"]["Tables"]["supplier_order_lines"]["Row"];

type Props = {
  sheetDates: string[];
  linesByDate: Record<string, SupplierOrderLineRow[]>;
  migrationHint: string | null;
  /** From Complete Orders → Pre-process documents links. */
  completeOrdersDocumentsView?: boolean;
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

function formatSheetTitle(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function productIdCellHtmlForPrint(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "—";
  const pt = supplierOrderProductIdHeadTail(trimmed);
  if (!pt) {
    return escHtml(trimmed);
  }
  return `<span style="color:rgba(100,116,139,0.6)">${escHtml(pt.head)}-</span><span style="font-size:1.2em;font-weight:700;color:#0f172a">${escHtml(pt.tail)}</span>`;
}

function lineTotalCents(row: SupplierOrderLineRow) {
  return Math.max(0, row.quantity) * Math.max(0, row.unit_price_cents);
}

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

function printSupplierDaySheet(
  ymd: string,
  lines: SupplierOrderLineRow[],
  productImageByProductKey: Record<string, string | null>,
) {
  const title = `Supplier orders — ${ymd} (Australia/Perth)`;
  const head = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escHtml(title)}</title><style>
    body{font-family:ui-sans-serif,system-ui,sans-serif;padding:16px;color:#0f172a;}
    h1{font-size:1.65rem;margin:0 0 12px;font-weight:600;}
    p.meta{font-size:18px;color:#64748b;margin:0 0 16px;}
    table{border-collapse:collapse;width:100%;font-size:16.5px;}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top;text-align:left;}
    th{background:#f1f5f9;font-weight:600;}
    td.num{font-variant-numeric:tabular-nums;}
    td.product-id-print{text-transform:uppercase;}
    caption{caption-side:top;text-align:left;font-weight:600;padding-bottom:8px;}
  </style></head><body>`;
  const caption = escHtml(formatSheetTitle(ymd));
  const rowHtml =
    lines.length === 0
      ? `<tr><td colspan="11" style="text-align:left;color:#64748b;padding:24px">No lines for this date.</td></tr>`
      : lines
          .map((r) => {
            const line = aud.format(lineTotalCents(r) / 100);
            const unit = aud.format(Math.max(0, r.unit_price_cents) / 100);
            const imgUrl = productImageByProductKey[r.product_id.trim()] ?? null;
            const imgCell = imgUrl
              ? `<td class="num"><img src="${escHtml(imgUrl)}" alt="" style="max-height:84px;max-width:120px;object-fit:contain;vertical-align:middle;display:block"/></td>`
              : `<td class="num">—</td>`;
            return `<tr>
            <td>${escHtml(normalizeSupplierOrderLineSupplierValue(r.supplier))}</td>
            <td class="num">${escHtml(r.customer_order_id)}</td>
            ${imgCell}
            <td class="num product-id-print">${productIdCellHtmlForPrint(r.product_id ?? "")}</td>
            <td>${escHtml(r.colour)}</td>
            <td>${escHtml(r.size)}</td>
            <td class="num">${r.quantity}</td>
            <td class="num">${r.ordered_date ? escHtml(r.ordered_date) : "—"}</td>
            <td class="num">${r.received_date ? escHtml(r.received_date) : "—"}</td>
            <td class="num">${escHtml(unit)}</td>
            <td class="num">${escHtml(line)}</td>
          </tr>`;
          })
          .join("");
  const table = `<h1>${escHtml(title)}</h1>
    <p class="meta">Printed ${escHtml(new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth", dateStyle: "medium", timeStyle: "short" }))}</p>
    <table><caption>${caption}</caption>
    <thead><tr>
      <th>Supplier name</th><th>Customer order ID</th><th>Image</th><th>Product ID</th><th>Colour</th><th>Size</th><th>Qty</th>
      <th>Ordered</th><th>Received</th><th>Unit (AUD)</th><th>Line</th>
    </tr></thead><tbody>${rowHtml}</tbody></table></body></html>`;

  const fullHtml = head + table;

  function writeAndPrint(target: Window) {
    target.document.open();
    target.document.write(fullHtml);
    target.document.close();
    target.focus();
    target.print();
  }

  /** Hidden iframe only — avoids opening a new browser tab before the system print dialog. */
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Supplier order sheet print");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    inset: "0",
    width: "0",
    height: "0",
    border: "none",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);
  const iwin = iframe.contentWindow;
  if (!iwin) {
    document.body.removeChild(iframe);
    window.alert("Could not open print preview. Try allowing pop-ups for this site, or use your browser print (⌘P).");
    return;
  }
  writeAndPrint(iwin);
  const removeIframe = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  iwin.addEventListener("afterprint", removeIframe, { once: true });
  setTimeout(removeIframe, 120_000);
}

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
    if (migrationHint || completeOrdersDocumentsView) return;
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
  }, [router, migrationHint, completeOrdersDocumentsView]);

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
            Complete Orders에서 연 Pre-process 링크입니다. 아래 시트는 열람·인쇄만 가능하며, 수정·Ready 토글은
            비활성화됩니다.
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
                    listDateTitle={formatSheetTitle(ymd)}
                    lines={lines}
                    migrationHint={migrationHint}
                    completeOrdersDocumentsView={completeOrdersDocumentsView}
                    readyForProcessing={Boolean(readyByDate[ymd])}
                    storeOrderNumberOptions={storeOrderNumberOptions}
                    productSupplierNameOptions={productSupplierNameOptions}
                    productImageByProductKey={productImageByProductKey}
                    onPrint={() => printSupplierDaySheet(ymd, lines, productImageByProductKey)}
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

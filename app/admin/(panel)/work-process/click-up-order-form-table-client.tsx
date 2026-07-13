"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StoreOrderBarcode } from "@/app/components/store-order-barcode";
import { storeOrderScanPayloadFromId } from "@/lib/store-order-scan-code";

import type { ClickUpOrderFormRow } from "./click-up-order-form-section";

function rowKey(row: ClickUpOrderFormRow) {
  return `${row.listDate}::${row.customerOrderId}`;
}

function clickUpSheetHref(row: ClickUpOrderFormRow) {
  return `/admin/click-up-sheet?${new URLSearchParams({
    list_date: row.listDate,
    customer_order_id: row.customerOrderId,
  }).toString()}`;
}

function rowSearchBlob(row: ClickUpOrderFormRow): string {
  return [
    row.listDate,
    row.storeOrderDateDisplay,
    row.organisationName,
    row.customerName,
    row.customerPhone,
    row.customerEmail,
    row.deliveryAddress,
    row.deliveryFeeDisplay,
    row.fulfillmentMethod === "Pickup" ? "pick up pickup" : "delivery",
    row.customerOrderId,
    row.processingStageLabel,
  ]
    .join(" ")
    .toLowerCase();
}

function processingStageCellClass(label: string): string {
  switch (label) {
    case "Dispatch":
      return "font-semibold text-amber-900";
    case "Quality control":
      return "font-semibold text-violet-900";
    case "Production":
      return "font-semibold text-sky-900";
    case "Click up":
      return "font-medium text-slate-800";
    default:
      return "text-slate-400";
  }
}

function rowMatchesQuery(row: ClickUpOrderFormRow, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const blob = rowSearchBlob(row);
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => blob.includes(t));
}

export function ClickUpOrderFormTableClient({ rows }: { rows: ClickUpOrderFormRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => rows.filter((r) => rowMatchesQuery(r, query)), [rows, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <label className="block min-w-0 flex-1 text-sm font-medium text-slate-700" htmlFor="click-up-order-form-search">
          Click up sheet 찾기
          <input
            id="click-up-order-form-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="날짜, 회사명, 고객명, 전화, 이메일, Order Type 또는 주문 ID"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-brand-orange/30 placeholder:text-slate-400 focus:border-brand-orange focus:ring-2"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <p className="shrink-0 text-xs text-slate-500 tabular-nums" aria-live="polite">
          {filtered.length === rows.length ? (
            <>총 {rows.length}건</>
          ) : (
            <>
              표시 {filtered.length}건 / 전체 {rows.length}건
            </>
          )}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-600">
          조건에 맞는 행이 없습니다. 날짜는 <span className="font-mono">YYYY-MM-DD</span> 형식으로도 검색할 수 있습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3" title="Supplier 워크시트 날짜 (Click up sheet URL의 list_date)">
                  Worksheet date
                </th>
                <th className="px-4 py-3">Store order date</th>
                <th className="px-4 py-3">Customer order ID</th>
                <th className="min-w-[9rem] px-4 py-3">Order barcode</th>
                <th className="px-4 py-3">Company Name</th>
                <th className="px-4 py-3">Customer name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="min-w-[12rem] px-4 py-3">Delivery address</th>
                <th className="px-4 py-3">Delivery fee paid</th>
                <th className="px-4 py-3">Order Type</th>
                <th
                  className="min-w-[10rem] whitespace-nowrap px-4 py-3"
                  title="Click up → Production → Quality control → Dispatch pipeline (read-only)."
                >
                  Processing Stage
                </th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={rowKey(row)} className="bg-white hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-800">{row.listDate}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-800">{row.storeOrderDateDisplay}</td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-navy">{row.customerOrderId}</td>
                  <td className="px-4 py-3">
                    {row.storeOrderId ? (
                      <StoreOrderBarcode
                        value={storeOrderScanPayloadFromId(row.storeOrderId)}
                        compact
                        showLabel={false}
                        className="max-w-[10.5rem]"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={row.organisationName}>
                    {row.organisationName}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={row.customerName}>
                    {row.customerName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700" title={row.customerPhone}>
                    {row.customerPhone}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-700" title={row.customerEmail}>
                    {row.customerEmail}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-slate-700" title={row.deliveryAddress}>
                    {row.deliveryAddress}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">
                    {row.deliveryFeeDisplay}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={
                        row.fulfillmentMethod === "Pickup"
                          ? "rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-sky-900"
                          : "rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-700"
                      }
                    >
                      {row.fulfillmentMethod === "Pickup" ? "Pick Up" : "Delivery"}
                    </span>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 ${processingStageCellClass(row.processingStageLabel)}`}>
                    {row.processingStageLabel}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={clickUpSheetHref(row)}
                      className="inline-flex rounded-lg bg-brand-orange px-3 py-2 text-xs font-semibold text-brand-navy transition hover:brightness-95"
                    >
                      Open Click up sheet
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

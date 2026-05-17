"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { StoreOrderHoldForm } from "@/app/admin/(panel)/store-orders/store-order-hold-form";
import { StoreOrderRefundPanel } from "@/app/admin/(panel)/store-orders/store-order-refund-panel";
import { StoreOrderInvoiceReferenceForm } from "@/app/admin/(panel)/store-orders/store-order-invoice-reference-form";
import {
  StoreOrderXeroLines,
  type StoreOrderXeroProductLine,
} from "@/app/admin/(panel)/store-orders/store-order-xero-lines";
import {
  formatOrderRowDateTime,
  formatPaymentDateForXero,
  STORE_ORDERS_DAYS_PER_PAGE,
  type StoreOrderDayGroup,
} from "@/app/admin/(panel)/store-orders/store-orders-list-helpers";
import { formatMoneyFromCents } from "@/lib/store-order-utils";

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
        <span className="ml-2 text-xs text-slate-500">({STORE_ORDERS_DAYS_PER_PAGE} days per page)</span>
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

type Props = {
  dayGroups: StoreOrderDayGroup[];
  itemsByOrderId: Record<string, StoreOrderXeroProductLine[]>;
  loadedOrderCount: number;
  dateRangeLabel: string;
  pageOpenedLabel: string;
  pageOpenedIso: string;
};

export function StoreOrdersByDayClient({
  dayGroups,
  itemsByOrderId,
  loadedOrderCount,
  dateRangeLabel,
  pageOpenedLabel,
  pageOpenedIso,
}: Props) {
  const [dayFilter, setDayFilter] = useState("");
  const [page, setPage] = useState(1);

  const allDayKeys = useMemo(() => dayGroups.map((g) => g.dayKey), [dayGroups]);

  const effectiveGroups = useMemo(() => {
    if (!dayFilter) return dayGroups;
    return dayGroups.filter((g) => g.dayKey === dayFilter);
  }, [dayGroups, dayFilter]);

  const totalPages = Math.max(1, Math.ceil(effectiveGroups.length / STORE_ORDERS_DAYS_PER_PAGE));

  useEffect(() => {
    setPage(1);
  }, [dayFilter]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const visibleGroups = useMemo(() => {
    const start = (page - 1) * STORE_ORDERS_DAYS_PER_PAGE;
    return effectiveGroups.slice(start, start + STORE_ORDERS_DAYS_PER_PAGE);
  }, [effectiveGroups, page]);

  const rangeLabel = useMemo(() => {
    if (visibleGroups.length === 0) return "—";
    const first = visibleGroups[0]!.dayKey;
    const last = visibleGroups[visibleGroups.length - 1]!.dayKey;
    if (first === last) return first;
    return `${last} → ${first}`;
  }, [visibleGroups]);

  const hasDayFilter = dayFilter.length > 0;
  const noOrdersForDay = hasDayFilter && effectiveGroups.length === 0;

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }

  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  if (dayGroups.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
        No orders in this date range.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Loaded <strong>{loadedOrderCount}</strong> order{loadedOrderCount === 1 ? "" : "s"} across{" "}
        <strong>{dayGroups.length}</strong> calendar day{dayGroups.length === 1 ? "" : "s"} ({dateRangeLabel}). Each
        screen lists up to <strong>{STORE_ORDERS_DAYS_PER_PAGE}</strong> days; use <strong>Previous</strong> /{" "}
        <strong>Next</strong> to move between pages.
      </p>
      <p className="text-xs text-slate-500">
        Page opened:{" "}
        <time dateTime={pageOpenedIso} className="text-slate-600">
          {pageOpenedLabel}
        </time>
      </p>

      <div className="w-full space-y-2">
        <label htmlFor="store-order-day-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Find orders by payment date
        </label>
        <div className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="store-order-day-filter"
            type="date"
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            min={allDayKeys.length > 0 ? allDayKeys[allDayKeys.length - 1] : undefined}
            max={allDayKeys.length > 0 ? allDayKeys[0] : undefined}
            className="min-h-[48px] w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
          {hasDayFilter ? (
            <button
              type="button"
              onClick={() => setDayFilter("")}
              className="shrink-0 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-brand-navy hover:bg-slate-50"
            >
              Show all days
            </button>
          ) : null}
        </div>
      </div>

      {noOrdersForDay ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
          No orders on <strong className="text-brand-navy">{dayFilter}</strong> in the loaded range ({dateRangeLabel}
          ). Choose another date or tap <strong>Show all days</strong>.
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

          <div className="space-y-6">
            {visibleGroups.map((group) => (
              <section
                key={group.dayKey}
                aria-labelledby={`store-orders-day-${group.dayKey}`}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
                  <p id={`store-orders-day-${group.dayKey}`} className="text-sm font-semibold text-brand-navy">
                    {group.dayHeading}
                  </p>
                  <p className="text-xs text-slate-600">
                    {group.orders.length} order{group.orders.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[1040px] w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <th className="px-4 py-3">Customer order ID</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="min-w-[12rem] px-4 py-3">Hold / note</th>
                        <th className="min-w-[22rem] px-4 py-3">Xero line items (ex GST)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.orders.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100 align-top last:border-b-0">
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/store-orders/${r.id}/ordered-items-list`}
                              className="font-mono font-semibold text-brand-navy hover:underline"
                            >
                              {r.order_number}
                            </Link>
                            <p className="text-xs text-slate-500">{formatOrderRowDateTime(r.created_at)}</p>
                            <Link
                              href={`/admin/store-orders/${r.id}/ordered-items-list`}
                              className="text-xs font-semibold text-brand-orange hover:underline"
                            >
                              Packing list →
                            </Link>
                            <StoreOrderInvoiceReferenceForm
                              orderId={r.id}
                              initialReference={r.invoice_reference}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{r.customer_name}</p>
                            <p className="text-xs text-slate-600">{r.customer_email}</p>
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {formatMoneyFromCents(r.total_cents, r.currency)}
                          </td>
                          <td className="px-4 py-3 capitalize">{r.status}</td>
                          <td className="px-4 py-3 align-top">
                            <StoreOrderHoldForm
                              orderId={r.id}
                              initialHoldProcess={r.hold_process}
                              initialHoldNote={r.hold_note}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-3">
                              {r.tracking_number ? (
                                <p className="text-sm">
                                  <span className="text-slate-500">Tracking: </span>
                                  <span className="font-mono font-semibold">{r.tracking_number}</span>
                                </p>
                              ) : (
                                <p className="text-xs text-slate-500">No tracking on file</p>
                              )}
                              <StoreOrderXeroLines
                                customerName={r.customer_name}
                                paymentDateLabel={formatPaymentDateForXero(r.created_at)}
                                currency={r.currency}
                                productLines={itemsByOrderId[r.id] ?? []}
                                deliveryFeeCentsInclGst={r.delivery_fee_cents}
                              />
                              <StoreOrderRefundPanel
                                orderId={r.id}
                                orderNumber={r.order_number}
                                status={r.status}
                                totalCents={r.total_cents}
                                currency={r.currency}
                                refundedCents={r.refunded_cents}
                                stripeCheckoutSessionId={r.stripe_checkout_session_id}
                                stripePaymentIntentId={r.stripe_payment_intent_id}
                                refundedAt={r.refunded_at}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
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

import Link from "next/link";

import {
  buildRefundsReportHref,
  defaultRefundsListFromYmd,
  formatRefundDate,
  formatRefundDateTime,
  loadStoreOrderRefundsReport,
  parseRefundsReportListQuery,
} from "@/lib/admin-store-order-refunds-report";
import { loadStoreCreditAdminSummary } from "@/lib/admin-store-credit-report";
import { formatMoneyFromCents } from "@/lib/store-order-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function SummaryCard({
  title,
  subtitle,
  total,
  count,
}: {
  title: string;
  subtitle: string;
  total: RefundPeriodTotalLike;
  count: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
      <p className="mt-0.5 text-[0.65rem] text-slate-500">{subtitle}</p>
      <p className="mt-2 text-2xl font-medium tabular-nums text-brand-navy">
        {formatMoneyFromCents(total.refundedCents, "AUD")}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {count} order{count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

type RefundPeriodTotalLike = { refundedCents: number };

function PeriodTotalsTable({
  title,
  description,
  rows,
  countHeader,
}: {
  title: string;
  description: string;
  rows: { key: string; label: string; count: number; refundedCents: number }[];
  countHeader: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
      <h2 className="text-lg font-medium text-brand-navy">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No refunds in range.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[20rem] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4 text-right">{countHeader}</th>
                <th className="py-2 text-right">Refunded (AUD)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-brand-navy">{row.label}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{row.count}</td>
                  <td className="py-2.5 text-right tabular-nums font-medium">
                    {formatMoneyFromCents(row.refundedCents, "AUD")}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 text-sm font-semibold text-brand-navy">
                <td className="py-2.5 pr-4">Total (shown)</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  {rows.reduce((s, r) => s + r.count, 0)}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatMoneyFromCents(
                    rows.reduce((s, r) => s + r.refundedCents, 0),
                    "AUD",
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function AdminAccountingRefundsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const listQuery = parseRefundsReportListQuery(sp);
  const report = await loadStoreOrderRefundsReport(listQuery);
  const creditSummary = await loadStoreCreditAdminSummary();

  const defaultFrom = defaultRefundsListFromYmd(report.labels.asOfPerthYmd);
  const listFrom = listQuery.from || defaultFrom;
  const listTo = listQuery.to || report.labels.asOfPerthYmd;
  const hasListFilter = Boolean(listQuery.from || listQuery.to || listQuery.q.trim());

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          /{" "}
          <Link href="/admin/accounting" className="text-brand-orange hover:underline">
            Accounting
          </Link>{" "}
          / Refunds &amp; Credit
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Refunds &amp; Credit</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          <strong>Card refunds</strong> processed via Stripe from online orders.{" "}
          <strong>Store credit</strong> is issued from each order&apos;s credit panel (Online orders) when a customer
          prefers credit over a card refund — credit applies automatically at their next checkout. Totals use{" "}
          <strong>refunded_at</strong> and cumulative <strong>refunded_cents</strong> (Australia/Perth). For manual
          refund logs entered for Xero, see{" "}
          <Link href="/admin/accounting" className="font-semibold text-brand-orange hover:underline">
            Accounting → manual refunds
          </Link>
          .
        </p>
      </header>

      {creditSummary.loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Store credit: {creditSummary.loadError}
        </div>
      ) : (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <h2 className="text-lg font-medium text-brand-navy">Store credit outstanding</h2>
          <p className="mt-1 text-sm text-slate-600">
            Total customer balances not yet redeemed at checkout.
          </p>
          <p className="mt-3 text-2xl font-medium tabular-nums text-brand-navy">
            {formatMoneyFromCents(creditSummary.totalOutstandingCents, "AUD")}
          </p>
          {creditSummary.recentIssues.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[32rem] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-emerald-200/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Issued</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4 text-right">Amount</th>
                    <th className="py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {creditSummary.recentIssues.map((row) => (
                    <tr key={row.id} className="border-b border-emerald-100/80 last:border-0">
                      <td className="py-2 pr-4 text-xs text-slate-600">
                        {formatRefundDateTime(row.created_at)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{row.customer_email}</td>
                      <td className="py-2 pr-4 text-right tabular-nums font-medium">
                        {formatMoneyFromCents(row.amount_cents, "AUD")}
                      </td>
                      <td className="py-2 text-xs text-slate-600">{(row.note ?? "").trim() || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No store credit issued yet.</p>
          )}
        </section>
      )}

      {report.loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {report.loadError}
        </div>
      ) : null}

      {!report.loadError ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Today"
              subtitle={report.summary.today.label}
              total={report.summary.today}
              count={report.summary.today.count}
            />
            <SummaryCard
              title="Month to date"
              subtitle={`From ${report.labels.monthStartsYmd}`}
              total={report.summary.monthToDate}
              count={report.summary.monthToDate.count}
            />
            <SummaryCard
              title="Quarter to date"
              subtitle={report.labels.quarterLabel}
              total={report.summary.quarterToDate}
              count={report.summary.quarterToDate.count}
            />
            <SummaryCard
              title="Year to date"
              subtitle={`From ${report.labels.yearStartsYmd}`}
              total={report.summary.yearToDate}
              count={report.summary.yearToDate.count}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <PeriodTotalsTable
              title="Monthly totals"
              description={`Calendar months with at least one refund since ${report.summary.allLoaded.label.replace("Since ", "")}.`}
              rows={report.monthly}
              countHeader="Orders"
            />
            <PeriodTotalsTable
              title="Quarterly totals"
              description="Calendar quarters (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec), Perth dates."
              rows={report.quarterly}
              countHeader="Orders"
            />
            <PeriodTotalsTable
              title="Annual totals"
              description="Totals by calendar year (refund date in Perth)."
              rows={report.annual}
              countHeader="Orders"
            />
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium text-brand-navy">Refunded orders</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {hasListFilter
                    ? `Filtered list · ${report.rows.length} row${report.rows.length === 1 ? "" : "s"}`
                    : `Last 90 days by default (${listFrom} → ${listTo}) · ${report.rows.length} row${report.rows.length === 1 ? "" : "s"}`}
                  {report.truncated
                    ? ` · Only the most recent ${2500} refunds since ${report.summary.allLoaded.label.replace("Since ", "")} are loaded; narrow dates if needed.`
                    : ""}
                </p>
              </div>
              <Link
                href="/admin/store-orders?refund=1"
                className="text-sm font-semibold text-brand-orange hover:underline"
              >
                Open in Store orders →
              </Link>
            </div>

            <form method="get" className="mt-4 flex flex-wrap items-end gap-3 border-b border-slate-100 pb-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Refund from (Perth)
                <input
                  type="date"
                  name="from"
                  defaultValue={listQuery.from || defaultFrom}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-sm text-brand-navy"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Refund to (Perth)
                <input
                  type="date"
                  name="to"
                  defaultValue={listQuery.to || report.labels.asOfPerthYmd}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-sm text-brand-navy"
                />
              </label>
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600 sm:min-w-[16rem]">
                Search
                <input
                  type="search"
                  name="q"
                  placeholder="Order #, email, name"
                  defaultValue={listQuery.q}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-sm text-brand-navy"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90"
              >
                Apply
              </button>
              <Link
                href="/admin/accounting/refunds"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-orange"
              >
                Reset
              </Link>
            </form>

            {report.rows.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No refunded orders match this filter.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[48rem] w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Refund date</th>
                      <th className="py-2 pr-3">Order</th>
                      <th className="py-2 pr-3">Customer</th>
                      <th className="py-2 pr-3 text-right">Order total</th>
                      <th className="py-2 pr-3 text-right">Refunded</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800">
                    {report.rows.map((row) => {
                      const fullyRefunded = row.refunded_cents >= row.total_cents && row.total_cents > 0;
                      return (
                        <tr key={row.id} className="border-b border-slate-100 last:border-0">
                          <td className="py-3 pr-3 align-top whitespace-nowrap">
                            <span className="block font-medium">{formatRefundDate(row.refunded_at)}</span>
                            <span className="text-xs text-slate-500">{formatRefundDateTime(row.refunded_at)}</span>
                          </td>
                          <td className="py-3 pr-3 align-top font-mono text-xs">{row.order_number || row.id.slice(0, 8)}</td>
                          <td className="py-3 pr-3 align-top">
                            <span className="block font-medium">{row.customer_name || "—"}</span>
                            <span className="text-xs text-slate-500">{row.customer_email || "—"}</span>
                          </td>
                          <td className="py-3 pr-3 text-right align-top tabular-nums">
                            {formatMoneyFromCents(row.total_cents, row.currency)}
                          </td>
                          <td className="py-3 pr-3 text-right align-top tabular-nums font-medium text-brand-navy">
                            {formatMoneyFromCents(row.refunded_cents, row.currency)}
                            {!fullyRefunded && row.total_cents > 0 ? (
                              <span className="mt-0.5 block text-xs font-normal text-amber-800">Partial</span>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3 align-top capitalize text-xs">{row.status.replace(/_/g, " ")}</td>
                          <td className="py-3 text-right align-top">
                            <Link
                              href={`/admin/store-orders/${row.id}/ordered-items-list`}
                              className="text-xs font-semibold text-brand-orange hover:underline"
                            >
                              Open →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 font-semibold text-brand-navy">
                      <td className="py-3 pr-3" colSpan={3}>
                        Total (filtered list)
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        {formatMoneyFromCents(
                          report.rows.reduce((s, r) => s + r.total_cents, 0),
                          "AUD",
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        {formatMoneyFromCents(
                          report.rows.reduce((s, r) => s + r.refunded_cents, 0),
                          "AUD",
                        )}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <Link
              href={buildRefundsReportHref({
                from: report.labels.monthStartsYmd,
                to: report.labels.asOfPerthYmd,
                q: "",
              })}
              className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 p-5 shadow-sm transition hover:bg-brand-orange/10"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">This month</p>
              <p className="mt-2 text-lg font-semibold text-brand-navy">View MTD refunds in list →</p>
            </Link>
            <Link
              href="/admin/accounting"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Accounting</p>
              <p className="mt-2 text-lg font-semibold text-brand-navy">Manual refund log →</p>
              <p className="mt-1 text-sm text-slate-600">Xero-aligned entries not tied to Stripe</p>
            </Link>
          </section>
        </>
      ) : null}
    </div>
  );
}

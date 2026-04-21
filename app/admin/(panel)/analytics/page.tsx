import Link from "next/link";

import { formatAudFromCents, loadStoreSalesAnalytics, type BucketRow, type PeriodTotals } from "@/lib/store-analytics-sales";

export const dynamic = "force-dynamic";

function KpiCard({ title, period }: { title: string; period: PeriodTotals }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-medium tabular-nums text-brand-navy">{formatAudFromCents(period.revenueCents)}</p>
      <p className="mt-1 text-xs text-slate-500">{period.orderCount} orders</p>
    </div>
  );
}

function BucketTable({ title, rows, emptyHint }: { title: string; rows: BucketRow[]; emptyHint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-medium text-brand-navy">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4 text-right">Orders</th>
                <th className="py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-700">{r.label}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-600">{r.orderCount}</td>
                  <td className="py-2 text-right font-medium tabular-nums text-brand-navy">{formatAudFromCents(r.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const { error, data } = await loadStoreSalesAnalytics();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Analytics
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Analytics</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          <strong>Store revenue</strong> below is derived from paid store orders (excluding cancelled). Marketing traffic and
          sessions can still be wired to GA / Plausible. The <strong>sales funnel</strong> (enquiry → completion) stays in{" "}
          <Link href="/admin/crm" className="font-semibold text-brand-orange hover:underline">
            CRM &amp; pipeline
          </Link>
          .
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{error}</div>
      ) : data ? (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-medium text-brand-navy">Revenue overview</h2>
              <p className="text-xs text-slate-500">
                Perth calendar · rolling window ending {data.range.endYmd}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard title={data.today.label} period={data.today} />
              <KpiCard title={data.last7Days.label} period={data.last7Days} />
              <KpiCard title={data.monthToDate.label} period={data.monthToDate} />
              <KpiCard title={data.last30Days.label} period={data.last30Days} />
              <KpiCard title={data.last365Days.label} period={data.last365Days} />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-medium text-brand-navy">Online vs in store</h3>
              <p className="mt-1 text-xs text-slate-500">Order totals · last 365 days (Perth dates)</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-600">Online checkout</dt>
                  <dd className="font-medium tabular-nums text-brand-navy">{formatAudFromCents(data.channel365.onlineCents)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">In store / internal (INT_…)</dt>
                  <dd className="font-medium tabular-nums text-brand-navy">{formatAudFromCents(data.channel365.inStoreCents)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-medium text-brand-navy">Apparel · embroidery · print</h3>
              <p className="mt-1 text-xs text-slate-500">Line subtotals · last 365 days (same order window)</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-600">Apparel / plain product lines</dt>
                  <dd className="font-medium tabular-nums text-brand-navy">{formatAudFromCents(data.service365.apparelCents)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-600">Embroidery</dt>
                  <dd className="font-medium tabular-nums text-emerald-800">{formatAudFromCents(data.service365.embroideryCents)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Print</dt>
                  <dd className="font-medium tabular-nums text-red-700">{formatAudFromCents(data.service365.printCents)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <BucketTable title="Daily — last 30 days" rows={data.daily} emptyHint="No orders in this range." />
            <BucketTable title="Weekly — last 12 weeks (Mon–Sun, Perth)" rows={data.weekly} emptyHint="No orders in this range." />
            <BucketTable title="Monthly — last 12 months" rows={data.monthly} emptyHint="No orders in this range." />
          </section>

          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
            {data.footnotes.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="min-h-[180px] rounded-xl border-2 border-dashed border-slate-300 bg-white p-6">
              <p className="text-sm font-medium text-slate-700">Traffic &amp; sessions</p>
              <p className="mt-2 text-xs text-slate-500">
                Embed Google Analytics, Plausible, or similar. Add the snippet in <code className="rounded bg-slate-100 px-1">layout.tsx</code>{" "}
                or use environment-driven script tags.
              </p>
            </div>
            <Link
              href="/admin/store-orders"
              className="min-h-[180px] rounded-xl border border-brand-orange/40 bg-brand-orange/5 p-6 transition hover:bg-brand-orange/10"
            >
              <p className="text-sm font-medium text-brand-navy">Store orders</p>
              <p className="mt-2 text-xs text-slate-600">Open the live order list, filters, and internal order flow.</p>
              <p className="mt-4 text-sm font-medium text-brand-orange">View orders →</p>
            </Link>
          </div>
        </>
      ) : null}

      {!error && !data ? (
        <p className="text-sm text-slate-600">No analytics data available.</p>
      ) : null}
    </div>
  );
}

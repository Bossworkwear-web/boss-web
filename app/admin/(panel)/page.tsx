import Link from "next/link";

import { loadDashboardStoreOrderPeriodStats } from "@/lib/admin-dashboard-store-order-stats";
import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";

import { buildRefundsReportHref } from "@/lib/admin-store-order-refunds-report";

import { buildStoreOrdersListHref } from "./store-orders/store-orders-list-helpers";

const LOW_STOCK = 10;

export default async function AdminDashboardPage() {
  let activeProducts = "—";
  let lowStock = "—";
  let totalUnits = "—";

  const orderStatsRes = await loadDashboardStoreOrderPeriodStats();

  try {
    const supabase = createSupabaseAdminClient();
    let data: { stock_quantity?: number | null }[] | null = null;
    const withStock = await supabase.from("products").select("stock_quantity, is_active").eq("is_active", true);
    if (!withStock.error && withStock.data) {
      data = withStock.data;
    } else {
      const msg = withStock.error?.message ?? "";
      if (msg.includes("stock_quantity")) {
        const idsOnly = await supabase.from("products").select("id").eq("is_active", true);
        if (!idsOnly.error && idsOnly.data) {
          activeProducts = String(idsOnly.data.length);
          lowStock = "—";
          totalUnits = "—";
        }
      }
    }

    if (data) {
      activeProducts = String(data.length);
      const stocks = data.map((p) => (typeof p.stock_quantity === "number" ? p.stock_quantity : 0));
      lowStock = String(stocks.filter((q) => q <= LOW_STOCK).length);
      totalUnits = String(stocks.reduce((a, b) => a + b, 0));
    }
  } catch (e) {
    console.error("[admin dashboard] product stock summary:", e);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-medium text-brand-navy">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Overview and quick links. Stock levels use the <strong>stock_quantity</strong> column (see migration).
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-brand-navy">Store orders received</h2>
        <p className="mt-1 text-sm text-slate-600">
          Count and totals by <strong>Australia/Perth</strong> calendar windows. Paid/processing/shipped orders only (
          <strong>cancelled</strong> excluded). Amounts are storefront order totals (GST inclusive), AUD.
        </p>
        {orderStatsRes.error ? (
          <p className="mt-4 text-sm text-amber-800">{orderStatsRes.error}</p>
        ) : orderStatsRes.stats ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[32rem] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4 text-right">Orders</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="w-24 py-2 pl-4 text-right"> </th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {(
                  [
                    {
                      key: "day",
                      title: "Daily",
                      subtitle: `Today (${orderStatsRes.stats.labels.asOfPerthYmd})`,
                      href: buildStoreOrdersListHref(
                        { ship: "all", from: orderStatsRes.stats.labels.asOfPerthYmd, to: orderStatsRes.stats.labels.asOfPerthYmd, q: "" },
                      ),
                      bucket: orderStatsRes.stats.day,
                    },
                    {
                      key: "week",
                      title: "Weekly",
                      subtitle: `This week · Mon ${orderStatsRes.stats.labels.weekStartsYmd} → ${orderStatsRes.stats.labels.asOfPerthYmd}`,
                      href: buildStoreOrdersListHref({
                        ship: "all",
                        from: orderStatsRes.stats.labels.weekStartsYmd,
                        to: orderStatsRes.stats.labels.asOfPerthYmd,
                        q: "",
                      }),
                      bucket: orderStatsRes.stats.week,
                    },
                    {
                      key: "month",
                      title: "Monthly",
                      subtitle: `Month to date · from ${orderStatsRes.stats.labels.monthStartsYmd}`,
                      href: buildStoreOrdersListHref({
                        ship: "all",
                        from: orderStatsRes.stats.labels.monthStartsYmd,
                        to: orderStatsRes.stats.labels.asOfPerthYmd,
                        q: "",
                      }),
                      bucket: orderStatsRes.stats.month,
                    },
                    {
                      key: "year",
                      title: "Yearly",
                      subtitle: `Year to date · from ${orderStatsRes.stats.labels.yearStartsYmd}`,
                      href: buildStoreOrdersListHref({
                        ship: "all",
                        from: orderStatsRes.stats.labels.yearStartsYmd,
                        to: orderStatsRes.stats.labels.asOfPerthYmd,
                        q: "",
                      }),
                      bucket: orderStatsRes.stats.year,
                    },
                  ] as const
                ).map((row) => (
                  <tr key={row.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 align-top">
                      <span className="font-semibold text-brand-navy">{row.title}</span>
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">{row.subtitle}</span>
                    </td>
                    <td className="py-3 pr-4 text-right align-top tabular-nums">{row.bucket.count}</td>
                    <td className="py-3 text-right align-top tabular-nums font-medium text-brand-navy">
                      {formatMoneyFromCents(row.bucket.totalCents, "AUD")}
                    </td>
                    <td className="py-3 pl-4 text-right align-top">
                      <Link href={row.href} className="text-xs font-semibold text-brand-orange hover:underline">
                        List →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">No data.</p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { title: "Active products", value: activeProducts, hint: "is_active = true" },
          { title: "Low stock SKUs", value: lowStock, hint: `≤ ${LOW_STOCK} units` },
          { title: "Total units on hand", value: totalUnits, hint: "Sum of stock_quantity" },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{card.title}</p>
            <p className="mt-2 text-2xl font-medium text-brand-navy">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
          </div>
        ))}
        <Link
          href="/admin/crm"
          className="rounded-xl border border-brand-orange/40 bg-brand-orange/5 p-4 shadow-sm transition hover:bg-brand-orange/10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Sales &amp; leads</p>
          <p className="mt-2 text-2xl font-medium text-brand-navy">CRM →</p>
          <p className="mt-1 text-xs text-slate-600">Quote requests, pipeline stages, follow-ups &amp; customers</p>
        </Link>
        <Link
          href="/admin/customer-invoices"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-orange/40 hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Invoices</p>
          <p className="mt-2 text-2xl font-medium text-brand-navy">Customer Invoices →</p>
          <p className="mt-1 text-xs text-slate-600">
            Edit tax invoice references for recent store orders (shown on PDFs)
          </p>
        </Link>
      </div>

      <section className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 p-6 shadow-sm">
        <h2 className="text-lg font-medium text-brand-navy">Stock management</h2>
        <p className="mt-2 text-sm text-slate-600">
          View and edit inventory quantities for every product. Run the database migration if you have not added{" "}
          <code className="rounded bg-white px-1">stock_quantity</code> yet.
        </p>
        <Link
          href="/admin/stock"
          className="mt-4 inline-flex rounded-xl bg-brand-orange px-5 py-2.5 text-sm font-medium text-brand-navy transition hover:brightness-95"
        >
          Open stock table →
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-brand-navy">Quick links</h2>
        <ul className="mt-4 grid gap-2 text-sm font-semibold text-brand-orange sm:grid-cols-2">
          <li>
            <Link href="/admin/warehouse" className="hover:underline">
              Warehouse · 창고 (매니저 / 작업자) →
            </Link>
          </li>
          <li>
            <Link href="/admin/crm" className="hover:underline">
              CRM &amp; pipeline (quotes &amp; follow-ups) →
            </Link>
          </li>
          <li>
            <Link href="/admin/stock" className="hover:underline">
              Stock management →
            </Link>
          </li>
          <li>
            <Link href="/admin/clearance-stock" className="hover:underline">
              Clearance Stock (manual lines) →
            </Link>
          </li>
          <li>
            <Link href="/admin/analytics" className="hover:underline">
              Analytics (traffic &amp; KPIs) →
            </Link>
          </li>
          <li>
            <Link href="/admin/reports" className="hover:underline">
              Reports &amp; exports →
            </Link>
          </li>
          <li>
            <Link href="/admin/accounting" className="hover:underline">
              Accounting (Xero workflow) →
            </Link>
          </li>
          <li>
            <Link href="/admin/accounting/refunds" className="hover:underline">
              Refunds (Stripe report) →
            </Link>
          </li>
          <li>
            <Link href="/admin/customer-invoices" className="hover:underline">
              Customer Invoices (tax invoice reference) →
            </Link>
          </li>
          <li>
            <Link href="/admin/supplier-orders" className="hover:underline">
              Supplier order lists →
            </Link>
          </li>
          <li>
            <Link href="/admin/store-orders" className="hover:underline">
              Store orders &amp; delivery dockets →
            </Link>
          </li>
          <li>
            <Link href="/admin/site" className="hover:underline">
              Site & content →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

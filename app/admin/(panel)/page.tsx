import Link from "next/link";

import { AdminGoogleMarketingLinks } from "@/app/admin/(panel)/analytics/admin-google-marketing-links";
import { StorefrontCatalogHealthBanner } from "@/app/admin/(panel)/storefront-catalog-health-banner";
import { loadDashboardStoreOrderPeriodStats } from "@/lib/admin-dashboard-store-order-stats";
import {
  resolveStoreOrderPickUpByIds,
  storeOrderFulfillmentLabel,
  type StoreOrderFulfillmentMethod,
} from "@/lib/store-order-fulfillment";
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

  type RecentOrderContact = {
    orderNumber: string;
    organisationName: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    fulfillmentMethod: StoreOrderFulfillmentMethod;
    createdAtDisplay: string;
  };
  let recentOrderContacts: RecentOrderContact[] = [];
  let recentOrdersError: string | null = null;

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

    const { data: recentOrders, error: recentErr } = await supabase
      .from("store_orders")
      .select("id, order_number, customer_name, customer_email, created_at")
      .in("status", ["paid", "processing", "shipped"])
      .order("created_at", { ascending: false })
      .limit(8);

    if (recentErr) {
      recentOrdersError = recentErr.message;
    } else {
      const emails = [
        ...new Set(
          (recentOrders ?? [])
            .map((r) => (r.customer_email ?? "").trim().toLowerCase())
            .filter(Boolean),
        ),
      ];
      const phoneByEmail = new Map<string, string>();
      const orgByEmail = new Map<string, string>();
      if (emails.length > 0) {
        const { data: profiles } = await supabase
          .from("customer_profiles")
          .select("email_address, contact_number, organisation")
          .in("email_address", emails);
        for (const p of profiles ?? []) {
          const key = p.email_address.trim().toLowerCase();
          phoneByEmail.set(key, (p.contact_number ?? "").trim());
          orgByEmail.set(key, (p.organisation ?? "").trim());
        }
      }
      const pickUpById = await resolveStoreOrderPickUpByIds(
        supabase,
        (recentOrders ?? []).map((r) => r.id),
      );
      const dateFmt = new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Perth",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      recentOrderContacts = (recentOrders ?? []).map((r) => {
        const email = (r.customer_email ?? "").trim();
        const emailKey = email.toLowerCase();
        const phone = email ? phoneByEmail.get(emailKey) ?? "" : "";
        const org = email ? orgByEmail.get(emailKey) ?? "" : "";
        return {
          orderNumber: r.order_number,
          organisationName: org || "—",
          customerName: (r.customer_name ?? "").trim() || "—",
          customerEmail: email || "—",
          customerPhone: phone || "—",
          fulfillmentMethod: storeOrderFulfillmentLabel(pickUpById.get(r.id) === true),
          createdAtDisplay: dateFmt.format(new Date(r.created_at)),
        };
      });
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

      <StorefrontCatalogHealthBanner />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-brand-navy">Recent orders — customer contact</h2>
            <p className="mt-1 text-sm text-slate-600">
              Latest paid store orders: Order ID, company, customer, phone, email, and order type.
            </p>
          </div>
          <Link
            href="/admin/work-process"
            className="text-sm font-semibold text-brand-orange hover:underline"
          >
            Open Click Up →
          </Link>
        </div>
        {recentOrdersError ? (
          <p className="mt-4 text-sm text-amber-800">{recentOrdersError}</p>
        ) : recentOrderContacts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No recent paid orders yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[48rem] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Order ID</th>
                  <th className="py-2 pr-4">When (Perth)</th>
                  <th className="py-2 pr-4">Company Name</th>
                  <th className="py-2 pr-4">Customer name</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2">Order Type</th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {recentOrderContacts.map((row) => (
                  <tr key={row.orderNumber} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-mono text-xs text-brand-navy">{row.orderNumber}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{row.createdAtDisplay}</td>
                    <td className="max-w-[10rem] truncate py-2 pr-4" title={row.organisationName}>
                      {row.organisationName}
                    </td>
                    <td className="py-2 pr-4">{row.customerName}</td>
                    <td className="whitespace-nowrap py-2 pr-4">{row.customerPhone}</td>
                    <td className="max-w-[14rem] truncate py-2 pr-4" title={row.customerEmail}>
                      {row.customerEmail}
                    </td>
                    <td className="whitespace-nowrap py-2">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
                      href: buildStoreOrdersListHref("/admin/online-orders", {
                        ship: "all",
                        from: orderStatsRes.stats.labels.asOfPerthYmd,
                        to: orderStatsRes.stats.labels.asOfPerthYmd,
                        q: "",
                      }),
                      bucket: orderStatsRes.stats.day,
                    },
                    {
                      key: "week",
                      title: "Weekly",
                      subtitle: `This week · Mon ${orderStatsRes.stats.labels.weekStartsYmd} → ${orderStatsRes.stats.labels.asOfPerthYmd}`,
                      href: buildStoreOrdersListHref("/admin/online-orders", {
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
                      href: buildStoreOrdersListHref("/admin/online-orders", {
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
                      href: buildStoreOrdersListHref("/admin/online-orders", {
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-brand-navy">Google marketing</h2>
            <p className="mt-1 text-sm text-slate-600">
              GA4 traffic &amp; conversions · Search Console indexing &amp; search queries
            </p>
          </div>
          <Link href="/admin/analytics" className="text-sm font-semibold text-brand-orange hover:underline">
            Full analytics →
          </Link>
        </div>
        <div className="mt-4">
          <AdminGoogleMarketingLinks variant="dashboard" />
        </div>
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
              Refunds &amp; Credit (Stripe report) →
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
            <Link href="/admin/online-orders" className="hover:underline">
              Online orders &amp; delivery dockets →
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

import Link from "next/link";

import { createSupabaseAdminClient } from "@/lib/supabase";

const LOW_STOCK = 10;

export default async function AdminDashboardPage() {
  let activeProducts = "—";
  let lowStock = "—";
  let totalUnits = "—";

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("products")
      .select("stock_quantity, is_active")
      .eq("is_active", true);

    if (!error && data) {
      activeProducts = String(data.length);
      const stocks = data.map((p) =>
        typeof p.stock_quantity === "number" ? p.stock_quantity : 0
      );
      lowStock = String(stocks.filter((q) => q <= LOW_STOCK).length);
      totalUnits = String(stocks.reduce((a, b) => a + b, 0));
    }
  } catch {
    // Supabase not configured or column missing
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-medium text-brand-navy">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Overview and quick links. Stock levels use the <strong>stock_quantity</strong> column (see migration).
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

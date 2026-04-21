import Link from "next/link";

import { aggregateSupplierLinesBySupplier } from "@/lib/supplier-order-monthly-summary";
import { normalizeSupplierOrderLineSupplierValue } from "@/lib/supplier-order-supplier-normalize";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { getPerthYmd, isPerthDayOfMonth, PERTH_TZ, supplierReportMonthRange } from "@/lib/perth-calendar";

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export default async function AdminReportsPage() {
  const now = new Date();
  const { year, month } = getPerthYmd(now);
  const showSupplierMonthly = isPerthDayOfMonth(now, 25);
  const { start, end } = supplierReportMonthRange(year, month);

  let supplierLoadError: string | null = null;
  let supplierRows = aggregateSupplierLinesBySupplier([]);

  if (showSupplierMonthly) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("supplier_order_lines")
        .select("supplier, quantity, unit_price_cents")
        .gte("ordered_date", start)
        .lte("ordered_date", end);

      if (error) {
        const missing =
          error.message.includes("supplier_order_lines") ||
          error.message.includes("does not exist") ||
          error.code === "42P01";
        supplierLoadError = missing
          ? "Run supabase/migrations/20260427_supplier_order_lines.sql to enable supplier summaries."
          : error.message;
      } else {
        supplierRows = aggregateSupplierLinesBySupplier(data ?? []);
      }
    } catch {
      supplierLoadError = "Could not load supplier order summary. Check Supabase configuration.";
    }
  }

  const grandQty = supplierRows.reduce((s, r) => s + r.totalQty, 0);
  const grandCents = supplierRows.reduce((s, r) => s + r.totalCents, 0);

  const monthLabel = new Intl.DateTimeFormat("en-AU", {
    timeZone: PERTH_TZ,
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 15));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Reports
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Reports</h1>
        <p className="mt-2 text-sm text-slate-600">
          <strong>Lead / quote exports</strong> use the same data as CRM —{" "}
          <Link href="/admin/crm" className="font-semibold text-brand-orange hover:underline">
            CRM &amp; pipeline → Export CSV
          </Link>
          .
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-medium text-brand-navy">Supplier orders — monthly snapshot</h2>
        <p className="mt-2 text-sm text-slate-600">
          On the <strong>25th</strong> of each month (calendar date in {PERTH_TZ.replaceAll("_", " ")}), this section lists
          each supplier&apos;s total <strong>quantity</strong> and <strong>order amount</strong> (qty × unit price) for
          lines with an <strong>Order date</strong> between the <strong>1st and 25th</strong> of that month. Enter unit
          prices on{" "}
          <Link href="/admin/supplier-orders" className="font-semibold text-brand-orange hover:underline">
            Supplier orders
          </Link>
          .
        </p>

        {!showSupplierMonthly ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Today is not the 25th in {PERTH_TZ.replaceAll("_", " ")} — the supplier summary table will appear here on that
            date.
          </p>
        ) : supplierLoadError ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {supplierLoadError}
          </p>
        ) : supplierRows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No lines in {monthLabel} with order date between {start} and {end} (inclusive).
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-3 text-sm font-semibold text-slate-800">
              {monthLabel} — order dates {start} to {end}
            </p>
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2 text-right">Total qty</th>
                  <th className="px-3 py-2 text-right">Order total</th>
                </tr>
              </thead>
              <tbody>
                {supplierRows.map((r) => (
                  <tr key={r.supplier} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-brand-navy">
                      {normalizeSupplierOrderLineSupplierValue(r.supplier)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800">{r.totalQty}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800">
                      {aud.format(r.totalCents / 100)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-3 py-2 text-brand-navy">All suppliers</td>
                  <td className="px-3 py-2 text-right font-mono">{grandQty}</td>
                  <td className="px-3 py-2 text-right font-mono">{aud.format(grandCents / 100)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-medium text-brand-navy">Future report templates</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-700">
          <li>Monthly sales by category (needs paid orders)</li>
          <li>Embroidery vs plain mix</li>
          <li>Customer acquisition (sign-ups)</li>
          <li>Delivery fee vs suburb</li>
        </ul>
        <p className="mt-6 text-xs text-slate-500">
          Implement as server actions or Edge functions writing CSV/PDF to Supabase Storage; schedule with Vercel Cron or
          Supabase pg_cron.
        </p>
      </div>
    </div>
  );
}

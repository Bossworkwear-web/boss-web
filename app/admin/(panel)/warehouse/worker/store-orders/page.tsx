import Link from "next/link";

import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function WarehouseWorkerCompletedStoreOrdersPage() {
  let rows: {
    id: string;
    order_number: string;
    status: string;
    customer_email: string;
    customer_name: string;
    total_cents: number;
    currency: string;
    tracking_number: string | null;
    shipped_at: string | null;
    created_at: string;
  }[] = [];
  let loadError: string | null = null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("store_orders")
      .select(
        "id, order_number, status, customer_email, customer_name, total_cents, currency, tracking_number, shipped_at, created_at",
      )
      .or("status.eq.shipped,shipped_at.not.is.null")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      loadError = error.message;
    } else {
      rows = data ?? [];
    }
  } catch {
    loadError = "Supabase is not configured or the store_orders table is missing.";
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          /{" "}
          <Link href="/admin/warehouse" className="text-brand-orange hover:underline">
            Warehouse
          </Link>{" "}
          /{" "}
          <Link href="/admin/warehouse/worker" className="text-brand-orange hover:underline">
            Worker
          </Link>{" "}
          / Completed store orders
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Completed store orders</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Shipped or fulfilled orders for packing reference. Use <strong>Print delivery docket</strong> for postage /
          counter copy, and <strong>Print ordered items list</strong> for a line-by-line picking checklist (same window).
        </p>
        <p className="mt-2 text-sm">
          <Link href="/admin/store-orders" className="font-semibold text-brand-orange hover:underline">
            All store orders (ship &amp; manage) →
          </Link>
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadError}</div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[960px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Customer order ID</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status / shipped</th>
              <th className="px-4 py-3 min-w-[18rem]">Print packing</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loadError ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No completed (shipped) store orders yet.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 align-middle">
                <td className="px-4 py-3 align-top">
                  <p className="font-mono font-semibold text-brand-navy">{r.order_number}</p>
                  <p className="text-xs text-slate-500">
                    Ordered{" "}
                    {new Date(r.created_at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="font-medium">{r.customer_name}</p>
                  <p className="text-xs text-slate-600">{r.customer_email}</p>
                </td>
                <td className="px-4 py-3 tabular-nums align-top">{formatMoneyFromCents(r.total_cents, r.currency)}</td>
                <td className="px-4 py-3 align-top">
                  <p className="capitalize">{r.status}</p>
                  {r.shipped_at ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Shipped:{" "}
                      {new Date(r.shipped_at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  ) : null}
                  {r.tracking_number ? (
                    <p className="mt-1 font-mono text-xs text-slate-600">{r.tracking_number}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-stretch gap-2 sm:max-w-[16rem]">
                    <Link
                      href={`/admin/warehouse/worker/order-mockups?${new URLSearchParams({ order: r.order_number }).toString()}`}
                      className="inline-flex items-center justify-center rounded-xl border-2 border-brand-navy/20 bg-white px-4 py-2.5 text-center text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50"
                    >
                      View mock-ups
                    </Link>
                    <Link
                      href={`/admin/store-orders/${r.id}/docket`}
                      className="inline-flex items-center justify-center rounded-xl bg-brand-orange px-4 py-2.5 text-center text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95"
                    >
                      Print delivery docket
                    </Link>
                    <Link
                      href={`/admin/store-orders/${r.id}/ordered-items-list`}
                      className="inline-flex items-center justify-center rounded-xl border-2 border-brand-navy/20 bg-white px-4 py-2.5 text-center text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50"
                    >
                      Print ordered items list
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

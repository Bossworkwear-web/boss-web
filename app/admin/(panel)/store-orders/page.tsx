import Link from "next/link";

import { DeleteStoreOrderButton } from "@/app/admin/(panel)/store-orders/delete-store-order-button";
import { ShipOrderForm } from "@/app/admin/(panel)/store-orders/ship-order-form";
import { StoreOrderInvoiceReferenceForm } from "@/app/admin/(panel)/store-orders/store-order-invoice-reference-form";
import {
  buildStoreOrdersListHref,
  parseStoreOrderListQuery,
  perthCalendarAddDays,
  perthDayEndIsoUtc,
  perthDayStartIsoUtc,
  perthTodayYmd,
  STORE_ORDERS_PAGE_SIZE,
  STORE_ORDERS_TZ,
  type StoreOrderListQuery,
} from "@/app/admin/(panel)/store-orders/store-orders-list-helpers";
import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type StoreOrderRow = {
  id: string;
  order_number: string;
  status: string;
  customer_email: string;
  customer_name: string;
  total_cents: number;
  currency: string;
  tracking_number: string | null;
  created_at: string;
  invoice_reference: string | null;
};

function parseOrderDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function calendarDayKey(iso: string): string {
  try {
    const d = parseOrderDate(iso);
    if (!d) {
      return "unknown-date";
    }
    return d.toLocaleDateString("en-CA", { timeZone: STORE_ORDERS_TZ });
  } catch {
    return parseOrderDate(iso)?.toISOString().slice(0, 10) ?? "unknown-date";
  }
}

function formatStoreOrderDayHeading(sampleIso: string): string {
  try {
    const d = parseOrderDate(sampleIso);
    if (!d) {
      return "Unknown date";
    }
    return d.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: STORE_ORDERS_TZ,
    });
  } catch {
    return parseOrderDate(sampleIso)?.toISOString().slice(0, 10) ?? "Unknown date";
  }
}

function formatOrderRowDateTime(iso: string): string {
  try {
    const d = parseOrderDate(iso);
    if (!d) {
      return "—";
    }
    return d.toLocaleString("en-AU", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: STORE_ORDERS_TZ,
    });
  } catch {
    return parseOrderDate(iso)?.toISOString().replace("T", " ").slice(0, 16) ?? "—";
  }
}

function groupOrdersByCalendarDay(rows: StoreOrderRow[]): { dayKey: string; orders: StoreOrderRow[] }[] {
  const map = new Map<string, StoreOrderRow[]>();
  for (const r of rows) {
    const key = calendarDayKey(r.created_at);
    const list = map.get(key);
    if (list) {
      list.push(r);
    } else {
      map.set(key, [r]);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dayKey, orders]) => ({ dayKey, orders }));
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminStoreOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const listQuery = parseStoreOrderListQuery(sp);
  const offset = (listQuery.page - 1) * STORE_ORDERS_PAGE_SIZE;

  let rows: StoreOrderRow[] = [];
  let loadError: string | null = null;
  let totalCount: number | null = null;

  try {
    const supabase = createSupabaseAdminClient();
    const selectCandidates = [
      "id, order_number, status, customer_email, customer_name, total_cents, currency, tracking_number, created_at, invoice_reference",
      "id, order_number, status, customer_email, customer_name, total_cents, currency, tracking_number, created_at",
    ] as const;

    let data: any[] | null = null;
    let error: { message?: string; code?: string } | null = null;
    let count: number | null = null;

    for (const select of selectCandidates) {
      let query = supabase
        .from("store_orders")
        .select(select, { count: "exact" })
        .order("created_at", { ascending: false });

      if (listQuery.ship === "pending") {
        query = query.neq("status", "shipped");
      } else if (listQuery.ship === "shipped") {
        query = query.eq("status", "shipped");
      }

      if (listQuery.from) {
        query = query.gte("created_at", perthDayStartIsoUtc(listQuery.from));
      }
      if (listQuery.to) {
        query = query.lte("created_at", perthDayEndIsoUtc(listQuery.to));
      }

      const searchTerm = listQuery.q.replace(/[%*,()]/g, "").trim().slice(0, 80);
      if (searchTerm.length > 0) {
        const pattern = `%${searchTerm}%`;
        query = query.or(
          `order_number.ilike.${pattern},customer_email.ilike.${pattern},customer_name.ilike.${pattern}`,
        );
      }

      query = query.range(offset, offset + STORE_ORDERS_PAGE_SIZE - 1);

      const result = await query;
      if (!result.error) {
        data = result.data as any[] | null;
        count = typeof result.count === "number" ? result.count : null;
        error = null;
        break;
      }
      error = result.error as any;
    }

    if (error) {
      loadError =
        error.message?.includes("invoice_reference") || error.code === "42703"
          ? `${error.message} — Supabase에 마이그레이션 supabase/migrations/20260452_store_orders_invoice_reference.sql 을 적용한 뒤 API 스키마를 새로고침하세요.`
          : error.message ?? "Load failed";
    } else {
      rows = (data ?? []).map((r) => ({
        ...r,
        invoice_reference: (r as { invoice_reference?: string | null }).invoice_reference ?? null,
      })) as StoreOrderRow[];
      totalCount = count;
    }
  } catch {
    loadError = "Supabase is not configured or the store_orders table is missing. Run the latest migration.";
  }

  const byDay = groupOrdersByCalendarDay(rows);
  const totalPages =
    totalCount != null ? Math.max(1, Math.ceil(totalCount / STORE_ORDERS_PAGE_SIZE)) : 1;
  const hasActiveFilters =
    listQuery.ship !== "all" || Boolean(listQuery.from) || Boolean(listQuery.to) || Boolean(listQuery.q.trim());
  const todayPerth = perthTodayYmd();
  const weekStartPerth = perthCalendarAddDays(todayPerth, -6);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-medium text-brand-navy">Store orders</h1>
          <Link
            href="/admin/store-orders/internal-order"
            className="inline-flex items-center justify-center rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95"
          >
            Create internal order →
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          After payment, orders appear here. Enter an Australia Post tracking number and mark shipped — the customer
          receives an email and can follow delivery on the public tracking page. Print a{" "}
          <strong>delivery docket</strong> for the Post Office or to tape on the box.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Orders are grouped by calendar day (Australia / Perth). Use filters below when the list grows.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadError}</div>
      ) : null}

      {!loadError ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 text-xs font-semibold text-slate-600">
            <span className="uppercase tracking-wide">Quick</span>
            <Link
              href={buildStoreOrdersListHref({ ship: "pending", from: "", to: "", q: "", page: 1 })}
              className={`rounded-full border px-3 py-1.5 transition ${
                listQuery.ship === "pending" && !listQuery.from && !listQuery.to && !listQuery.q.trim()
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-slate-200 bg-slate-50 text-brand-navy hover:border-brand-orange"
              }`}
            >
              Needs shipping
            </Link>
            <Link
              href={buildStoreOrdersListHref(
                { ship: "all", from: weekStartPerth, to: todayPerth, q: "", page: 1 },
                {},
              )}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-brand-navy transition hover:border-brand-orange"
            >
              Last 7 days
            </Link>
            <Link
              href="/admin/store-orders"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-brand-orange hover:text-brand-navy"
            >
              Reset all
            </Link>
          </div>
          <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="page" value="1" />
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Fulfillment
              <select
                name="ship"
                defaultValue={listQuery.ship}
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm text-brand-navy"
              >
                <option value="all">All</option>
                <option value="pending">Not shipped yet</option>
                <option value="shipped">Shipped</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              From (Perth)
              <input
                type="date"
                name="from"
                defaultValue={listQuery.from}
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm text-brand-navy"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              To (Perth)
              <input
                type="date"
                name="to"
                defaultValue={listQuery.to}
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
          </form>
          {totalCount != null ? (
            <p className="mt-3 text-xs text-slate-500">
              Showing {rows.length === 0 ? 0 : offset + 1}–{offset + rows.length} of {totalCount} matching
              order{totalCount === 1 ? "" : "s"}
              {hasActiveFilters ? " (filtered)" : ""} · {STORE_ORDERS_PAGE_SIZE} per page
            </p>
          ) : null}
        </section>
      ) : null}

      {rows.length === 0 && !loadError ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          {hasActiveFilters ? "No orders match these filters." : "No orders yet."}
        </div>
      ) : null}

      <div className="space-y-6">
        {byDay.map(({ dayKey, orders }) => (
          <div
            key={dayKey}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-brand-navy">
                {formatStoreOrderDayHeading(orders[0]!.created_at)}
              </p>
              <p className="text-xs text-slate-600">
                {orders.length} order{orders.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3">Customer order ID</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ship / docket</th>
                    <th className="px-4 py-3 w-[5.5rem]">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 align-top last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-brand-navy">{r.order_number}</p>
                        <p className="text-xs text-slate-500">{formatOrderRowDateTime(r.created_at)}</p>
                        <StoreOrderInvoiceReferenceForm
                          orderId={r.id}
                          initialReference={r.invoice_reference}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.customer_name}</p>
                        <p className="text-xs text-slate-600">{r.customer_email}</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatMoneyFromCents(r.total_cents, r.currency)}</td>
                      <td className="px-4 py-3 capitalize">{r.status}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-3">
                          <ShipOrderForm
                            orderId={r.id}
                            alreadyShipped={r.status === "shipped"}
                            existingTracking={r.tracking_number}
                          />
                          <a
                            href={`/admin/store-orders/${r.id}/docket`}
                            className="inline-block py-2 text-[1.4rem] font-semibold leading-tight text-brand-orange hover:underline"
                          >
                            Print delivery docket
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <DeleteStoreOrderButton orderId={r.id} orderNumber={r.order_number} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {!loadError && totalPages > 1 ? (
        <PaginationBar listQuery={listQuery} totalPages={totalPages} />
      ) : null}
    </div>
  );
}

function PaginationBar({
  listQuery,
  totalPages,
}: {
  listQuery: StoreOrderListQuery;
  totalPages: number;
}) {
  const { page } = listQuery;
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
      aria-label="Order list pages"
    >
      <span className="text-slate-600">
        Page <span className="font-semibold text-brand-navy">{page}</span> of{" "}
        <span className="font-semibold text-brand-navy">{totalPages}</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {page > 1 ? (
          <Link
            href={buildStoreOrdersListHref(listQuery, { page: page - 1 })}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-brand-navy hover:border-brand-orange"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-slate-400">Previous</span>
        )}
        {page < totalPages ? (
          <Link
            href={buildStoreOrdersListHref(listQuery, { page: page + 1 })}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-brand-navy hover:border-brand-orange"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-slate-400">Next</span>
        )}
      </div>
    </nav>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";

import { StoreOrdersByDayClient } from "@/app/admin/(panel)/store-orders/store-orders-by-day-client";
import {
  ADMIN_STORE_ORDER_DAY_WINDOW,
  buildStoreOrdersListHref,
  groupStoreOrdersByCalendarDay,
  parseStoreOrderListQuery,
  perthCalendarAddDays,
  perthDayEndIsoUtc,
  perthDayStartIsoUtc,
  perthTodayYmd,
  resolveStoreOrdersListDateRange,
  STORE_ORDERS_FETCH_LIMIT,
  type StoreOrderListRow,
} from "@/app/admin/(panel)/store-orders/store-orders-list-helpers";
import type { StoreOrderXeroProductLine } from "@/app/admin/(panel)/store-orders/store-order-xero-lines";
import {
  isInstoreStoreOrder,
  isOnlineStoreOrder,
  storeOrdersListBasePath,
  type StoreOrderChannel,
} from "@/lib/store-order-channel";
import { createSupabaseAdminClient } from "@/lib/supabase";

function formatGeneratedAt(date: Date) {
  return date.toLocaleString("en-AU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Australia/Perth",
  });
}

const CHANNEL_COPY: Record<
  StoreOrderChannel,
  { title: string; description: ReactNode; emptyHint: string }
> = {
  online: {
    title: "Online orders",
    description: (
      <>
        Orders paid through the <strong>website Stripe checkout</strong>. Line-item breakdown (ex GST) supports Xero.
        Shipped status is set from{" "}
        <Link href="/admin/dispatch" className="font-semibold text-brand-orange hover:underline">
          Dispatch
        </Link>
        ; tracking on file (if any) is shown in the list.
      </>
    ),
    emptyHint: "No online orders in this date range.",
  },
  instore: {
    title: "Instore orders",
    description: (
      <>
        Orders created in admin (<strong>in-store / phone / internal</strong>) — no Stripe checkout on file. Use the same
        dispatch and Xero flow where applicable.
      </>
    ),
    emptyHint: "No instore orders in this date range.",
  },
};

export async function StoreOrdersListPage({
  channel,
  searchParams,
}: {
  channel: StoreOrderChannel;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const listBase = storeOrdersListBasePath(channel);
  const otherBase = storeOrdersListBasePath(channel === "online" ? "instore" : "online");
  const copy = CHANNEL_COPY[channel];
  const listQuery = parseStoreOrderListQuery(searchParams);
  const { fromYmd, toYmd } = resolveStoreOrdersListDateRange(listQuery);
  const generatedAt = new Date();

  let rows: StoreOrderListRow[] = [];
  let itemsByOrderId: Record<string, StoreOrderXeroProductLine[]> = {};
  let loadError: string | null = null;
  let truncated = false;

  try {
    const supabase = createSupabaseAdminClient();
    const selectCandidates = [
      "id, order_number, status, customer_email, customer_name, total_cents, delivery_fee_cents, currency, tracking_number, created_at, invoice_reference, hold_process, hold_note, refunded_cents, refunded_at, stripe_checkout_session_id, stripe_payment_intent_id",
      "id, order_number, status, customer_email, customer_name, total_cents, delivery_fee_cents, currency, tracking_number, created_at, invoice_reference, hold_process, hold_note",
      "id, order_number, status, customer_email, customer_name, total_cents, delivery_fee_cents, currency, tracking_number, created_at, invoice_reference",
      "id, order_number, status, customer_email, customer_name, total_cents, delivery_fee_cents, currency, tracking_number, created_at",
      "id, order_number, status, customer_email, customer_name, total_cents, currency, tracking_number, created_at, invoice_reference, hold_process, hold_note",
      "id, order_number, status, customer_email, customer_name, total_cents, currency, tracking_number, created_at, invoice_reference",
      "id, order_number, status, customer_email, customer_name, total_cents, currency, tracking_number, created_at",
    ] as const;

    let data: unknown[] | null = null;
    let error: { message?: string; code?: string } | null = null;

    for (const select of selectCandidates) {
      let query = supabase
        .from("store_orders")
        .select(select)
        .gte("created_at", perthDayStartIsoUtc(fromYmd))
        .lte("created_at", perthDayEndIsoUtc(toYmd))
        .order("created_at", { ascending: false })
        .limit(STORE_ORDERS_FETCH_LIMIT);

      if (listQuery.ship === "pending") {
        query = query.neq("status", "shipped");
      } else if (listQuery.ship === "shipped") {
        query = query.eq("status", "shipped");
      }

      const searchTerm = listQuery.q.replace(/[%*,()]/g, "").trim().slice(0, 80);
      if (searchTerm.length > 0) {
        const pattern = `%${searchTerm}%`;
        query = query.or(
          `order_number.ilike.${pattern},customer_email.ilike.${pattern},customer_name.ilike.${pattern}`,
        );
      }

      const result = await query;
      if (!result.error) {
        data = result.data as unknown[] | null;
        error = null;
        break;
      }
      error = result.error as { message?: string; code?: string };
    }

    if (error) {
      loadError =
        error.message?.includes("invoice_reference") || error.code === "42703"
          ? `${error.message} — Supabase에 마이그레이션 supabase/migrations/20260452_store_orders_invoice_reference.sql (및 hold: 20260512_store_orders_hold_process.sql) 을 적용한 뒤 API 스키마를 새로고침하세요.`
          : error.message ?? "Load failed";
    } else {
      const mapped = (data ?? []).map((r) => {
        const rec = r as {
          invoice_reference?: string | null;
          hold_process?: boolean | null;
          hold_note?: string | null;
          delivery_fee_cents?: number;
          refunded_cents?: number | null;
          refunded_at?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
        };
        return {
          ...(r as StoreOrderListRow),
          delivery_fee_cents: Number(rec.delivery_fee_cents) || 0,
          invoice_reference: rec.invoice_reference ?? null,
          hold_process: Boolean(rec.hold_process),
          hold_note: rec.hold_note != null && String(rec.hold_note).trim() !== "" ? String(rec.hold_note) : null,
          refunded_cents: Number(rec.refunded_cents) || 0,
          refunded_at: rec.refunded_at ?? null,
          stripe_checkout_session_id: rec.stripe_checkout_session_id ?? null,
          stripe_payment_intent_id: rec.stripe_payment_intent_id ?? null,
        };
      }) as StoreOrderListRow[];

      rows = mapped.filter((r) =>
        channel === "online" ? isOnlineStoreOrder(r) : isInstoreStoreOrder(r),
      );

      truncated = mapped.length >= STORE_ORDERS_FETCH_LIMIT;

      const orderIds = rows.map((r) => r.id);
      if (orderIds.length > 0) {
        const { data: itemRows, error: itemsErr } = await supabase
          .from("store_order_items")
          .select("order_id, product_id, product_name, quantity, unit_price_cents, line_total_cents, sort_order")
          .in("order_id", orderIds)
          .order("sort_order", { ascending: true });

        if (!itemsErr && itemRows) {
          const productIds = [
            ...new Set(
              itemRows
                .map((raw) => String((raw as { product_id?: string }).product_id ?? "").trim())
                .filter(Boolean),
            ),
          ];
          const supplierByProductId = new Map<string, string>();
          if (productIds.length > 0) {
            const { data: products } = await supabase
              .from("products")
              .select("id, supplier_name")
              .in("id", productIds);
            for (const p of products ?? []) {
              const pid = String((p as { id?: string }).id ?? "").trim();
              if (!pid) continue;
              supplierByProductId.set(pid, String((p as { supplier_name?: string }).supplier_name ?? "").trim());
            }
          }

          const map: Record<string, StoreOrderXeroProductLine[]> = {};
          for (const raw of itemRows) {
            const orderId = String((raw as { order_id?: string }).order_id ?? "");
            if (!orderId) continue;
            const productId = String((raw as { product_id?: string }).product_id ?? "").trim();
            const line: StoreOrderXeroProductLine = {
              productId,
              supplierName: productId ? (supplierByProductId.get(productId) ?? "") : "",
              productName: String((raw as { product_name?: string }).product_name ?? ""),
              quantity: Number((raw as { quantity?: number }).quantity) || 1,
              unitPriceCentsInclGst: Number((raw as { unit_price_cents?: number }).unit_price_cents) || 0,
              lineTotalCentsInclGst: Number((raw as { line_total_cents?: number }).line_total_cents) || 0,
            };
            if (map[orderId]) {
              map[orderId]!.push(line);
            } else {
              map[orderId] = [line];
            }
          }
          itemsByOrderId = map;
        }
      }
    }
  } catch {
    loadError = "Supabase is not configured or the store_orders table is missing. Run the latest migration.";
  }

  const dayGroups = groupStoreOrdersByCalendarDay(rows);
  const hasActiveFilters =
    listQuery.ship !== "all" || Boolean(listQuery.from) || Boolean(listQuery.to) || Boolean(listQuery.q.trim());
  const todayPerth = perthTodayYmd();
  const weekStartPerth = perthCalendarAddDays(todayPerth, -6);
  const dateRangeLabel = listQuery.from || listQuery.to ? `${fromYmd} → ${toYmd}` : `last ${ADMIN_STORE_ORDER_DAY_WINDOW} days (${fromYmd} → ${toYmd})`;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium text-brand-navy">{copy.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              <Link href={otherBase} className="font-semibold text-brand-orange hover:underline">
                {channel === "online" ? "Instore orders" : "Online orders"}
              </Link>
            </p>
          </div>
          {channel === "instore" ? (
            <Link
              href="/admin/instore-orders/internal-order"
              className="inline-flex items-center justify-center rounded-xl bg-brand-orange px-[1.3rem] py-[0.65rem] text-[1.1375rem] font-semibold leading-tight text-brand-navy shadow-sm transition hover:brightness-95"
            >
              Create instore order →
            </Link>
          ) : null}
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{copy.description}</p>
        <p className="mt-2 text-xs text-slate-500">
          Orders are grouped by order date (Australia / Perth). Use <strong>Previous</strong> / <strong>Next</strong> to
          browse day groups ({ADMIN_STORE_ORDER_DAY_WINDOW}-day default window when no date filter).
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
              href={buildStoreOrdersListHref(listBase, { ship: "pending", from: "", to: "", q: "" })}
              className={`rounded-full border px-3 py-1.5 transition ${
                listQuery.ship === "pending" && !listQuery.from && !listQuery.to && !listQuery.q.trim()
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-slate-200 bg-slate-50 text-brand-navy hover:border-brand-orange"
              }`}
            >
              Needs shipping
            </Link>
            <Link
              href={buildStoreOrdersListHref(listBase, { ship: "all", from: weekStartPerth, to: todayPerth, q: "" })}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-brand-navy transition hover:border-brand-orange"
            >
              Last 7 days
            </Link>
            <Link
              href={listBase}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-brand-orange hover:text-brand-navy"
            >
              Reset all
            </Link>
          </div>
          <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
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
          <p className="mt-3 text-xs text-slate-500">
            Date range: {dateRangeLabel}
            {hasActiveFilters ? " (filtered)" : ""}
            {truncated ? ` · Showing first ${STORE_ORDERS_FETCH_LIMIT} orders in range before channel filter; narrow dates if needed.` : ""}
            {rows.length === 0 && !hasActiveFilters ? ` · ${copy.emptyHint}` : ""}
          </p>
        </section>
      ) : null}

      {!loadError ? (
        <StoreOrdersByDayClient
          dayGroups={dayGroups}
          itemsByOrderId={itemsByOrderId}
          loadedOrderCount={rows.length}
          dateRangeLabel={dateRangeLabel}
          pageOpenedLabel={formatGeneratedAt(generatedAt)}
          pageOpenedIso={generatedAt.toISOString()}
        />
      ) : null}
    </div>
  );
}

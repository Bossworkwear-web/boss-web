import Link from "next/link";

import { getPerthYmd } from "@/lib/perth-calendar";
import {
  resolveStoreOrderPickUpByIds,
  storeOrderFulfillmentLabel,
} from "@/lib/store-order-fulfillment";
import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";

import { ClickUpOrderFormSection, type ClickUpOrderFormRow } from "./click-up-order-form-section";

export const dynamic = "force-dynamic";

function formatSheetTitle(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function processingStageLabelFromQueues(
  storeOrderId: string | null,
  dispatchIds: Set<string>,
  qcIds: Set<string>,
  productionIds: Set<string>,
): string {
  if (!storeOrderId) return "—";
  if (dispatchIds.has(storeOrderId)) return "Dispatch";
  if (qcIds.has(storeOrderId)) return "Quality control";
  if (productionIds.has(storeOrderId)) return "Production";
  return "Click up";
}

export default async function AdminWorkProcessPage() {
  const now = new Date();
  const { ymd: todayPerthYmd, year, month, day } = getPerthYmd(now);
  const todayLabel = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  type ReadySheet = { listDate: string; title: string; lineCount: number };
  let readySupplierSheets: ReadySheet[] = [];
  /** Supplier worksheet dates that have lines on the Click up sheet list (`click_up_sheet_list`). */
  let clickUpSheetListItems: ReadySheet[] = [];
  let clickUpOrderFormRows: ClickUpOrderFormRow[] = [];

  try {
    const supabase = createSupabaseAdminClient();

    const { data: flagRows, error: flagErr } = await supabase
      .from("supplier_daily_sheets")
      .select("list_date")
      .eq("ready_for_processing", true)
      .order("list_date", { ascending: false });

    if (!flagErr && flagRows?.length) {
      const dates = flagRows.map((r) => r.list_date);
      const { data: lineRows, error: lineErr } = await supabase
        .from("supplier_order_lines")
        .select("list_date")
        .in("list_date", dates);

      const counts = new Map<string, number>();
      for (const dt of dates) counts.set(dt, 0);
      if (!lineErr && lineRows) {
        for (const row of lineRows) {
          const k = row.list_date;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
      readySupplierSheets = dates.map((listDate) => ({
        listDate,
        title: formatSheetTitle(listDate),
        lineCount: counts.get(listDate) ?? 0,
      }));
    }

    const { data: cupRows, error: cupErr } = await supabase
      .from("click_up_sheet_list")
      .select("list_date, created_at")
      .order("created_at", { ascending: false });

    if (!cupErr && cupRows?.length) {
      const seen = new Set<string>();
      const cupDates: string[] = [];
      for (const r of cupRows) {
        const d = r.list_date;
        if (!seen.has(d)) {
          seen.add(d);
          cupDates.push(d);
        }
      }
      const { data: cupLines, error: cupLineErr } = await supabase
        .from("supplier_order_lines")
        .select("list_date")
        .in("list_date", cupDates);

      const cupCounts = new Map<string, number>();
      for (const dt of cupDates) cupCounts.set(dt, 0);
      if (!cupLineErr && cupLines) {
        for (const row of cupLines) {
          const k = row.list_date;
          cupCounts.set(k, (cupCounts.get(k) ?? 0) + 1);
        }
      }
      clickUpSheetListItems = cupDates.map((listDate) => ({
        listDate,
        title: formatSheetTitle(listDate),
        lineCount: cupCounts.get(listDate) ?? 0,
      }));
    }

    if (clickUpSheetListItems.length === 0 && readySupplierSheets.length > 0) {
      clickUpSheetListItems = readySupplierSheets.map((s) => ({ ...s }));
    }

    const sheetDatesForClickUp = clickUpSheetListItems.map((s) => s.listDate);
    if (sheetDatesForClickUp.length > 0) {
      const { data: solPairs, error: solPairsErr } = await supabase
        .from("supplier_order_lines")
        .select("list_date, customer_order_id")
        .in("list_date", sheetDatesForClickUp);

      if (!solPairsErr && solPairs?.length) {
        const seen = new Set<string>();
        const pairs: { listDate: string; customerOrderId: string }[] = [];
        for (const r of solPairs) {
          const customerOrderId = (r.customer_order_id ?? "").trim();
          if (!customerOrderId) continue;
          const key = `${r.list_date}\n${customerOrderId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          pairs.push({ listDate: r.list_date, customerOrderId });
        }

        pairs.sort((a, b) => {
          if (a.listDate !== b.listDate) return a.listDate < b.listDate ? 1 : -1;
          return a.customerOrderId.localeCompare(b.customerOrderId);
        });

        const orderNumbers = [...new Set(pairs.map((p) => p.customerOrderId))];
        const storeByNumber = new Map<
          string,
          {
            id: string;
            created_at: string;
            customer_name: string;
            customer_email: string;
            delivery_address: string;
            delivery_fee_cents: number;
          }
        >();
        const orgByEmail = new Map<string, string>();
        const phoneByEmail = new Map<string, string>();

        if (orderNumbers.length > 0) {
          const { data: storeRows } = await supabase
            .from("store_orders")
            .select(
              "id, order_number, created_at, customer_name, customer_email, delivery_address, delivery_fee_cents",
            )
            .in("order_number", orderNumbers);

          const emails = new Set<string>();
          for (const row of storeRows ?? []) {
            storeByNumber.set(row.order_number, {
              id: row.id,
              created_at: row.created_at,
              customer_name: row.customer_name ?? "",
              customer_email: row.customer_email ?? "",
              delivery_address: row.delivery_address ?? "",
              delivery_fee_cents: Math.max(0, Number(row.delivery_fee_cents) || 0),
            });
            const e = row.customer_email.trim().toLowerCase();
            if (e) emails.add(e);
          }

          if (emails.size > 0) {
            const { data: profileRows } = await supabase
              .from("customer_profiles")
              .select("email_address, organisation, contact_number")
              .in("email_address", [...emails]);

            for (const row of profileRows ?? []) {
              const key = row.email_address.trim().toLowerCase();
              orgByEmail.set(key, row.organisation?.trim() ?? "");
              phoneByEmail.set(key, row.contact_number?.trim() ?? "");
            }
          }
        }

        const storeIdsForCompleteCheck = [
          ...new Set(
            pairs
              .map((p) => storeByNumber.get(p.customerOrderId)?.id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const completeStoreOrderIds = new Set<string>();
        if (storeIdsForCompleteCheck.length > 0) {
          const { data: cqRows } = await supabase
            .from("click_up_complete_orders_queue")
            .select("store_order_id")
            .in("store_order_id", storeIdsForCompleteCheck);
          for (const r of cqRows ?? []) {
            completeStoreOrderIds.add(r.store_order_id);
          }
        }

        const pairsForClickUp = pairs.filter((p) => {
          const sid = storeByNumber.get(p.customerOrderId)?.id;
          if (!sid) return true;
          return !completeStoreOrderIds.has(sid);
        });

        const storeOrderDateFmt = new Intl.DateTimeFormat("en-AU", {
          timeZone: "Australia/Perth",
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        const pickUpById = await resolveStoreOrderPickUpByIds(
          supabase,
          [...storeByNumber.values()].map((s) => s.id),
        );

        clickUpOrderFormRows = pairsForClickUp.map(({ listDate, customerOrderId }) => {
          const so = storeByNumber.get(customerOrderId);
          const storeOrderDateDisplay = so
            ? storeOrderDateFmt.format(new Date(so.created_at))
            : "—";
          const email = so?.customer_email?.trim().toLowerCase() ?? "";
          const org = email ? orgByEmail.get(email) : undefined;
          const organisationName = org && org.length > 0 ? org : "—";
          const customerName = so?.customer_name?.trim() || "—";
          const customerEmail = so?.customer_email?.trim() || "—";
          const phone = email ? phoneByEmail.get(email) : undefined;
          const customerPhone = phone && phone.length > 0 ? phone : "—";
          const fulfillmentMethod = storeOrderFulfillmentLabel(
            so?.id ? pickUpById.get(so.id) === true : false,
          );
          const deliveryAddress = so?.delivery_address?.trim() || "—";
          const feeCents = so?.delivery_fee_cents ?? 0;
          const deliveryFeeDisplay =
            feeCents <= 0 ? "Free / $0.00" : formatMoneyFromCents(feeCents, "AUD");

          return {
            listDate,
            customerOrderId,
            storeOrderId: so?.id ?? null,
            storeOrderDateDisplay,
            organisationName,
            customerName,
            customerEmail,
            customerPhone,
            fulfillmentMethod,
            deliveryAddress,
            deliveryFeeDisplay,
            processingStageLabel: "—",
          };
        });

        const storeIdsForQueues = [
          ...new Set(
            clickUpOrderFormRows.map((r) => r.storeOrderId).filter((id): id is string => Boolean(id)),
          ),
        ];
        const storeIdsInProductionQueue = new Set<string>();
        const storeIdsInQcQueue = new Set<string>();
        const storeIdsInDispatchQueue = new Set<string>();
        if (storeIdsForQueues.length > 0) {
          const [prodRes, qcRes, dispRes] = await Promise.all([
            supabase.from("click_up_production_queue").select("store_order_id").in("store_order_id", storeIdsForQueues),
            supabase.from("click_up_qc_queue").select("store_order_id").in("store_order_id", storeIdsForQueues),
            supabase.from("click_up_dispatch_queue").select("store_order_id").in("store_order_id", storeIdsForQueues),
          ]);
          if (!prodRes.error && prodRes.data?.length) {
            for (const row of prodRes.data) {
              storeIdsInProductionQueue.add(row.store_order_id);
            }
          }
          if (!qcRes.error && qcRes.data?.length) {
            for (const row of qcRes.data) {
              storeIdsInQcQueue.add(row.store_order_id);
            }
          }
          if (!dispRes.error && dispRes.data?.length) {
            for (const row of dispRes.data) {
              storeIdsInDispatchQueue.add(row.store_order_id);
            }
          }
        }
        clickUpOrderFormRows = clickUpOrderFormRows.map((r) => ({
          ...r,
          processingStageLabel: processingStageLabelFromQueues(
            r.storeOrderId,
            storeIdsInDispatchQueue,
            storeIdsInQcQueue,
            storeIdsInProductionQueue,
          ),
        }));
      }
    }
  } catch {
    // Supabase not configured or tables missing
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Click Up
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Click Up</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          <strong>Web checkout</strong>가 해당 Perth 날짜의 Supplier 라인을 만들 때 같은 날짜가 Click up sheet 목록에
          자동으로 추가됩니다. 날짜는 <strong>Australia / Perth</strong> 기준입니다. ({todayLabel})
        </p>
      </header>

      <p className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
        오늘 Perth 날짜:{" "}
        <span className="font-mono font-semibold text-brand-navy">{todayPerthYmd}</span> ({year}-
        {String(month).padStart(2, "0")}-{String(day).padStart(2, "0")})
      </p>

      <div className="space-y-4">
        <ClickUpOrderFormSection rows={clickUpOrderFormRows} sheetsReady={clickUpSheetListItems.length > 0} />
      </div>
    </div>
  );
}

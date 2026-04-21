import Link from "next/link";

import { getPerthYmd } from "@/lib/perth-calendar";
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
  /** Created when Supplier orders → Ready for Processing is checked (`click_up_sheet_list`). */
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
          { id: string; created_at: string; customer_name: string; customer_email: string }
        >();
        const orgByEmail = new Map<string, string>();

        if (orderNumbers.length > 0) {
          const { data: storeRows } = await supabase
            .from("store_orders")
            .select("id, order_number, created_at, customer_name, customer_email")
            .in("order_number", orderNumbers);

          const emails = new Set<string>();
          for (const row of storeRows ?? []) {
            storeByNumber.set(row.order_number, {
              id: row.id,
              created_at: row.created_at,
              customer_name: row.customer_name ?? "",
              customer_email: row.customer_email ?? "",
            });
            const e = row.customer_email.trim().toLowerCase();
            if (e) emails.add(e);
          }

          if (emails.size > 0) {
            const { data: profileRows } = await supabase
              .from("customer_profiles")
              .select("email_address, organisation")
              .in("email_address", [...emails]);

            for (const row of profileRows ?? []) {
              orgByEmail.set(row.email_address.trim().toLowerCase(), row.organisation?.trim() ?? "");
            }
          }
        }

        const storeOrderDateFmt = new Intl.DateTimeFormat("en-AU", {
          timeZone: "Australia/Perth",
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        clickUpOrderFormRows = pairs.map(({ listDate, customerOrderId }) => {
          const so = storeByNumber.get(customerOrderId);
          const storeOrderDateDisplay = so
            ? storeOrderDateFmt.format(new Date(so.created_at))
            : "—";
          const email = so?.customer_email?.trim().toLowerCase() ?? "";
          const org = email ? orgByEmail.get(email) : undefined;
          const organisationName = org && org.length > 0 ? org : "—";
          const customerName = so?.customer_name?.trim() || "—";

          return {
            listDate,
            customerOrderId,
            storeOrderId: so?.id ?? null,
            storeOrderDateDisplay,
            organisationName,
            customerName,
            movedToProduction: false,
          };
        });

        const storeIdsForProduction = [
          ...new Set(
            clickUpOrderFormRows
              .map((r) => r.storeOrderId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const storeIdsInProductionQueue = new Set<string>();
        if (storeIdsForProduction.length > 0) {
          const { data: prodQ, error: prodQErr } = await supabase
            .from("click_up_production_queue")
            .select("store_order_id")
            .in("store_order_id", storeIdsForProduction);
          if (!prodQErr && prodQ?.length) {
            for (const row of prodQ) {
              storeIdsInProductionQueue.add(row.store_order_id);
            }
          }
        }
        clickUpOrderFormRows = clickUpOrderFormRows.map((r) => ({
          ...r,
          movedToProduction: Boolean(r.storeOrderId && storeIdsInProductionQueue.has(r.storeOrderId)),
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
          <strong>Supplier orders</strong>에서 일별 시트 하단의 <strong>Ready for Processing</strong>를 체크하면 같은
          날짜가 Click up sheet 목록에 생성됩니다. 날짜는 <strong>Australia / Perth</strong> 기준입니다. ({todayLabel})
        </p>
      </header>

      <p className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
        오늘 Perth 날짜:{" "}
        <span className="font-mono font-semibold text-brand-navy">{todayPerthYmd}</span> ({year}-
        {String(month).padStart(2, "0")}-{String(day).padStart(2, "0")})
      </p>

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Ready supplier worksheets</h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-600">
            주문별 <strong>Move to Production</strong> 여부는 아래 <strong>Click up Order Form</strong> 표의{" "}
            <strong>Move to Production</strong> 열(빨간 ✓)에서 확인합니다.
          </p>
        </div>
        {readySupplierSheets.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            체크된 시트가 없습니다.{" "}
            <Link href="/admin/supplier-orders" className="font-semibold text-brand-orange hover:underline">
              Supplier orders
            </Link>
            에서 해당 날짜 표 하단의 <strong>Ready for Processing</strong>를 켜 주세요.
          </div>
        ) : (
          <ul className="space-y-3">
            {readySupplierSheets.map((s) => (
              <li key={s.listDate}>
                <Link
                  href={`/admin/supplier-orders#supplier-sheet-${s.listDate}`}
                  className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-orange/40 hover:shadow-md"
                >
                  <p className="font-semibold text-brand-navy">{s.title}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{s.listDate}</p>
                  <p className="mt-3 text-2xl font-medium text-brand-navy">
                    {s.lineCount}{" "}
                    <span className="text-base font-normal text-slate-500">lines</span>
                  </p>
                  <p className="mt-2 text-sm font-semibold text-brand-orange">Open worksheet →</p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <ClickUpOrderFormSection rows={clickUpOrderFormRows} sheetsReady={clickUpSheetListItems.length > 0} />
      </div>
    </div>
  );
}

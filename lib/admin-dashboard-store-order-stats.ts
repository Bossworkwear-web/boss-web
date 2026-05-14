import { getPerthYmd, perthMondayYmdOfWeekContaining } from "@/lib/perth-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase";

function perthDayStartIsoUtc(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T00:00:00+08:00`).toISOString();
}

function perthDayEndIsoUtc(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T23:59:59.999+08:00`).toISOString();
}

export type DashboardStoreOrderPeriodBucket = {
  count: number;
  totalCents: number;
};

export type DashboardStoreOrderPeriodStats = {
  day: DashboardStoreOrderPeriodBucket;
  week: DashboardStoreOrderPeriodBucket;
  month: DashboardStoreOrderPeriodBucket;
  year: DashboardStoreOrderPeriodBucket;
  labels: {
    asOfPerthYmd: string;
    weekStartsYmd: string;
    monthStartsYmd: string;
    yearStartsYmd: string;
  };
};

/** Store orders in Perth windows; excludes `cancelled`. One query for YTD then buckets in memory. */
export async function loadDashboardStoreOrderPeriodStats(): Promise<{
  stats: DashboardStoreOrderPeriodStats | null;
  error: string | null;
}> {
  try {
    const supabase = createSupabaseAdminClient();
    const now = new Date();
    const { ymd: todayYmd, year, month } = getPerthYmd(now);
    const weekStartYmd = perthMondayYmdOfWeekContaining(todayYmd);
    const monthStartYmd = `${year}-${String(month).padStart(2, "0")}-01`;
    const yearStartYmd = `${year}-01-01`;

    const dayStart = perthDayStartIsoUtc(todayYmd);
    const dayEnd = perthDayEndIsoUtc(todayYmd);
    const weekStart = perthDayStartIsoUtc(weekStartYmd);
    const monthStart = perthDayStartIsoUtc(monthStartYmd);
    const yearStart = perthDayStartIsoUtc(yearStartYmd);

    const { data, error } = await supabase
      .from("store_orders")
      .select("created_at, total_cents, status")
      .gte("created_at", yearStart)
      .lte("created_at", dayEnd);

    if (error) {
      const missing =
        error.message.includes("store_orders") ||
        error.message.includes("does not exist") ||
        error.code === "42P01";
      return {
        stats: null,
        error: missing ? "Store orders table not available." : error.message,
      };
    }

    const empty = (): DashboardStoreOrderPeriodBucket => ({ count: 0, totalCents: 0 });
    const day = empty();
    const week = empty();
    const monthAgg = empty();
    const yearAgg = empty();

    for (const r of data ?? []) {
      if (String(r.status ?? "").toLowerCase() === "cancelled") continue;
      const ts = String(r.created_at ?? "");
      const centsRaw = r.total_cents;
      const cents = typeof centsRaw === "number" ? centsRaw : Number(centsRaw);
      const c = Number.isFinite(cents) ? cents : 0;

      if (ts >= dayStart && ts <= dayEnd) {
        day.count += 1;
        day.totalCents += c;
      }
      if (ts >= weekStart && ts <= dayEnd) {
        week.count += 1;
        week.totalCents += c;
      }
      if (ts >= monthStart && ts <= dayEnd) {
        monthAgg.count += 1;
        monthAgg.totalCents += c;
      }
      if (ts >= yearStart && ts <= dayEnd) {
        yearAgg.count += 1;
        yearAgg.totalCents += c;
      }
    }

    return {
      stats: {
        day,
        week,
        month: monthAgg,
        year: yearAgg,
        labels: {
          asOfPerthYmd: todayYmd,
          weekStartsYmd: weekStartYmd,
          monthStartsYmd: monthStartYmd,
          yearStartsYmd: yearStartYmd,
        },
      },
      error: null,
    };
  } catch {
    return { stats: null, error: "Could not load store order stats." };
  }
}

import { getPerthYmd, perthMondayYmdOfWeekContaining } from "@/lib/perth-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase";

function perthDayStartIsoUtc(yyyyMmDd: string): string | null {
  const d = new Date(`${yyyyMmDd}T00:00:00+08:00`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

function perthDayEndIsoUtc(yyyyMmDd: string): string | null {
  const d = new Date(`${yyyyMmDd}T23:59:59.999+08:00`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

function supabaseErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) {
      return msg;
    }
  }
  return String(error ?? "Unknown database error");
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
    if (!dayStart || !dayEnd || !weekStart || !monthStart || !yearStart) {
      return { stats: null, error: "Could not resolve Perth calendar boundaries for store order stats." };
    }

    const { data, error } = await supabase
      .from("store_orders")
      .select("created_at, total_cents, status")
      .gte("created_at", yearStart)
      .lte("created_at", dayEnd);

    if (error) {
      const msg = supabaseErrorMessage(error);
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";
      const missing =
        msg.includes("store_orders") || msg.includes("does not exist") || code === "42P01";
      return {
        stats: null,
        error: missing ? "Store orders table not available." : msg,
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e ?? "");
    console.error("[loadDashboardStoreOrderPeriodStats]", e);
    return {
      stats: null,
      error: msg.trim() || "Could not load store order stats.",
    };
  }
}

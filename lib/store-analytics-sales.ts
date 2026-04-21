import { addCalendarDaysYmd, getPerthYmd, PERTH_TZ } from "@/lib/perth-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase";

function perthDayStartIsoUtc(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T00:00:00+08:00`).toISOString();
}

const AUD = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function formatAudFromCents(cents: number): string {
  return AUD.format(cents / 100);
}

export type OrderChannel = "online" | "in_store";

/** Internal / counter orders use `INT_…`; web checkout uses `BOS_…` (and other non-INT prefixes). */
export function orderChannelFromNumber(orderNumber: string): OrderChannel {
  return orderNumber.trim().toUpperCase().startsWith("INT_") ? "in_store" : "online";
}

export function perthYmdFromIso(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: PERTH_TZ });
  } catch {
    return "1970-01-01";
  }
}

const WEEKDAY_SUN0: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function perthWeekdaySun0FromIso(iso: string): number {
  const short = new Intl.DateTimeFormat("en-AU", {
    timeZone: PERTH_TZ,
    weekday: "short",
  }).format(new Date(iso));
  return WEEKDAY_SUN0[short] ?? 0;
}

/** Monday-start week; returns Perth calendar YYYY-MM-DD of the Monday. */
export function weekMondayYmdFromIso(iso: string): string {
  const ymd = perthYmdFromIso(iso);
  const sun0 = perthWeekdaySun0FromIso(iso);
  const mondayOffset = (sun0 + 6) % 7;
  return addCalendarDaysYmd(ymd, -mondayOffset);
}

export function monthYmFromIso(iso: string): string {
  return perthYmdFromIso(iso).slice(0, 7);
}

/**
 * Split line revenue into apparel vs embellishment buckets.
 * Lines with both embroidery and printing split 50/50 between embroidery and print cents.
 */
export function allocateLineCentsByService(
  lineTotalCents: number,
  serviceType: string | null,
): { apparel: number; embroidery: number; print: number } {
  const n = Math.max(0, Math.trunc(lineTotalCents));
  const s = (serviceType ?? "").toLowerCase();
  const emb = s.includes("embroidery");
  const prt = s.includes("printing");
  if (emb && prt) {
    const half = Math.round(n / 2);
    return { apparel: 0, embroidery: half, print: n - half };
  }
  if (emb) return { apparel: 0, embroidery: n, print: 0 };
  if (prt) return { apparel: 0, embroidery: 0, print: n };
  return { apparel: n, embroidery: 0, print: 0 };
}

export type StoreOrderSalesRow = {
  id: string;
  order_number: string;
  total_cents: number;
  status: string;
  created_at: string;
};

export type StoreOrderItemSalesRow = {
  order_id: string;
  line_total_cents: number;
  service_type: string | null;
};

export type PeriodTotals = {
  label: string;
  revenueCents: number;
  orderCount: number;
};

export type BucketRow = {
  key: string;
  label: string;
  revenueCents: number;
  orderCount: number;
};

export type ChannelTotals = {
  onlineCents: number;
  inStoreCents: number;
};

export type ServiceTotals = {
  apparelCents: number;
  embroideryCents: number;
  printCents: number;
};

export type StoreSalesAnalytics = {
  range: { startYmd: string; endYmd: string };
  /** KPIs — all exclude cancelled; revenue = sum of order total_cents */
  today: PeriodTotals;
  last7Days: PeriodTotals;
  monthToDate: PeriodTotals;
  last30Days: PeriodTotals;
  last365Days: PeriodTotals;
  /** Tables */
  daily: BucketRow[];
  weekly: BucketRow[];
  monthly: BucketRow[];
  /** Order totals in range */
  channel365: ChannelTotals;
  /** Line-item subtotals (excludes delivery allocation); same window as orders */
  service365: ServiceTotals;
  footnotes: string[];
};

const CHUNK = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function sumOrdersInYmdSet(
  orders: StoreOrderSalesRow[],
  ymdSet: Set<string>,
): { revenueCents: number; orderCount: number } {
  let revenueCents = 0;
  let orderCount = 0;
  for (const o of orders) {
    const y = perthYmdFromIso(o.created_at);
    if (ymdSet.has(y)) {
      revenueCents += Math.max(0, o.total_cents);
      orderCount += 1;
    }
  }
  return { revenueCents, orderCount };
}

function ymdRangeInclusive(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  let cur = startYmd;
  while (cur <= endYmd) {
    out.push(cur);
    cur = addCalendarDaysYmd(cur, 1);
  }
  return out;
}

function formatDayHeading(ymd: string): string {
  try {
    return new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-AU", {
      timeZone: PERTH_TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return ymd;
  }
}

function formatWeekHeading(mondayYmd: string): string {
  const end = addCalendarDaysYmd(mondayYmd, 6);
  try {
    const a = new Date(`${mondayYmd}T12:00:00+08:00`).toLocaleDateString("en-AU", {
      timeZone: PERTH_TZ,
      day: "numeric",
      month: "short",
    });
    const b = new Date(`${end}T12:00:00+08:00`).toLocaleDateString("en-AU", {
      timeZone: PERTH_TZ,
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${a} – ${b}`;
  } catch {
    return mondayYmd;
  }
}

function formatMonthHeading(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function buildStoreSalesAnalytics(orders: StoreOrderSalesRow[], items: StoreOrderItemSalesRow[]): StoreSalesAnalytics {
  const { ymd: todayYmd } = getPerthYmd();
  const start365 = addCalendarDaysYmd(todayYmd, -364);
  const orderById = new Map(orders.map((o) => [o.id, o]));

  const last7 = new Set<string>();
  for (let i = 0; i < 7; i++) {
    last7.add(addCalendarDaysYmd(todayYmd, -i));
  }

  const monthPrefix = todayYmd.slice(0, 7);
  const monthStart = `${monthPrefix}-01`;
  const monthDaySet = new Set(ymdRangeInclusive(monthStart, todayYmd));

  const last30Start = addCalendarDaysYmd(todayYmd, -29);
  const last30Set = new Set(ymdRangeInclusive(last30Start, todayYmd));

  const todayOnly = new Set([todayYmd]);

  const sumPeriod = (set: Set<string>): PeriodTotals => ({
    label: "",
    ...sumOrdersInYmdSet(orders, set),
  });

  const today = { ...sumPeriod(todayOnly), label: "Today (Perth)" };
  const last7Days = { ...sumPeriod(last7), label: "Last 7 days (Perth)" };
  const monthToDate = { ...sumPeriod(monthDaySet), label: "Month to date (Perth)" };
  const last30Days = { ...sumPeriod(last30Set), label: "Last 30 days (Perth)" };
  const last365DaySet = new Set(ymdRangeInclusive(start365, todayYmd));
  const last365Days = { ...sumPeriod(last365DaySet), label: "Last 365 days (Perth)" };

  const dailyKeys = [...ymdRangeInclusive(last30Start, todayYmd)].reverse();
  const daily: BucketRow[] = dailyKeys.map((key) => {
    const { revenueCents, orderCount } = sumOrdersInYmdSet(orders, new Set([key]));
    return { key, label: formatDayHeading(key), revenueCents, orderCount };
  });

  const weekSet = new Set<string>();
  for (const o of orders) {
    const y = perthYmdFromIso(o.created_at);
    if (y >= start365 && y <= todayYmd) {
      weekSet.add(weekMondayYmdFromIso(o.created_at));
    }
  }
  const weekList = [...weekSet].sort((a, b) => b.localeCompare(a)).slice(0, 12);
  const weekly: BucketRow[] = weekList.map((key) => {
    const monday = key;
    const sunday = addCalendarDaysYmd(monday, 6);
    let revenueCents = 0;
    let orderCount = 0;
    for (const o of orders) {
      const y = perthYmdFromIso(o.created_at);
      if (y >= monday && y <= sunday) {
        revenueCents += Math.max(0, o.total_cents);
        orderCount += 1;
      }
    }
    return { key, label: formatWeekHeading(monday), revenueCents, orderCount };
  });

  const monthSet = new Set<string>();
  for (const o of orders) {
    const y = perthYmdFromIso(o.created_at);
    if (y >= start365 && y <= todayYmd) {
      monthSet.add(monthYmFromIso(o.created_at));
    }
  }
  const monthList = [...monthSet].sort((a, b) => b.localeCompare(a)).slice(0, 12);
  const monthly: BucketRow[] = monthList.map((key) => {
    let revenueCents = 0;
    let orderCount = 0;
    const prefix = `${key}-`;
    for (const o of orders) {
      const y = perthYmdFromIso(o.created_at);
      if (y.startsWith(prefix)) {
        revenueCents += Math.max(0, o.total_cents);
        orderCount += 1;
      }
    }
    return { key, label: formatMonthHeading(key), revenueCents, orderCount };
  });

  let onlineCents = 0;
  let inStoreCents = 0;
  for (const o of orders) {
    const y = perthYmdFromIso(o.created_at);
    if (y < start365 || y > todayYmd) continue;
    const ch = orderChannelFromNumber(o.order_number);
    const t = Math.max(0, o.total_cents);
    if (ch === "online") onlineCents += t;
    else inStoreCents += t;
  }

  const orderIds365 = new Set<string>();
  for (const o of orders) {
    const y = perthYmdFromIso(o.created_at);
    if (y >= start365 && y <= todayYmd) orderIds365.add(o.id);
  }

  let apparelCents = 0;
  let embroideryCents = 0;
  let printCents = 0;
  for (const it of items) {
    if (!orderIds365.has(it.order_id)) continue;
    const a = allocateLineCentsByService(it.line_total_cents, it.service_type);
    apparelCents += a.apparel;
    embroideryCents += a.embroidery;
    printCents += a.print;
  }

  const footnotes = [
    "Revenue uses each order’s total (includes delivery). Cancelled orders are excluded.",
    "Online vs In store: orders whose number starts with INT_ are treated as in-store (internal); others as online checkout.",
    "Apparel / Embroidery / Print: based on line subtotals in the same 365-day window; mixed lines split evenly between embroidery and print.",
  ];

  return {
    range: { startYmd: start365, endYmd: todayYmd },
    today,
    last7Days,
    monthToDate,
    last30Days,
    last365Days,
    daily,
    weekly,
    monthly,
    channel365: { onlineCents, inStoreCents },
    service365: { apparelCents, embroideryCents, printCents },
    footnotes,
  };
}

export async function loadStoreSalesAnalytics(): Promise<{ error: string | null; data: StoreSalesAnalytics | null }> {
  try {
    const supabase = createSupabaseAdminClient();
    const { ymd: todayYmd } = getPerthYmd();
    const startYmd = addCalendarDaysYmd(todayYmd, -400);
    const startIso = perthDayStartIsoUtc(startYmd);

    const orders: StoreOrderSalesRow[] = [];
    let from = 0;
    const pageSize = 1000;
    for (;;) {
      const { data, error } = await supabase
        .from("store_orders")
        .select("id, order_number, total_cents, status, created_at")
        .gte("created_at", startIso)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        const missing =
          error.message.includes("store_orders") ||
          error.message.includes("does not exist") ||
          error.code === "42P01";
        return {
          error: missing
            ? "Store orders table not found. Apply supabase/migrations/20260426_store_orders.sql."
            : error.message,
          data: null,
        };
      }
      const rows = (data ?? []) as StoreOrderSalesRow[];
      orders.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    const ids = orders.map((o) => o.id);
    const items: StoreOrderItemSalesRow[] = [];
    for (const part of chunk(ids, CHUNK)) {
      if (part.length === 0) continue;
      const { data, error } = await supabase
        .from("store_order_items")
        .select("order_id, line_total_cents, service_type")
        .in("order_id", part);
      if (error) {
        return { error: error.message, data: null };
      }
      for (const row of data ?? []) {
        items.push(row as StoreOrderItemSalesRow);
      }
    }

    return { error: null, data: buildStoreSalesAnalytics(orders, items) };
  } catch {
    return { error: "Could not load sales data. Check Supabase configuration.", data: null };
  }
}

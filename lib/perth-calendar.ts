/** Calendar date parts in Australia/Perth (AWST, UTC+8 — no DST). */
export const PERTH_TZ = "Australia/Perth";
export const PERTH_LOCALE = "en-AU";

/** Apply Perth as the Node.js process timezone (server scripts, cron, SSR). */
export function ensureNodeTimezone(): void {
  if (process.env.TZ !== PERTH_TZ) {
    process.env.TZ = PERTH_TZ;
  }
}

/** Today's calendar date in Perth as `YYYY-MM-DD`. */
export function todayPerthYmd(now = new Date()): string {
  return getPerthYmd(now).ymd;
}

/** UTC ISO bounds for one Perth calendar day (for DB `timestamptz` filters). */
export function getPerthDayUtcRange(date = new Date()): {
  startIso: string;
  endIso: string;
  label: string;
} {
  const { ymd: label } = getPerthYmd(date);
  const startMs = Date.parse(`${label}T00:00:00+08:00`);
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    label,
  };
}

type FormatPerthDateTimeOptions = {
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
};

function toDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format an instant for display in Perth (default: medium date + short time). */
export function formatPerthDateTime(
  value: string | Date,
  options: FormatPerthDateTimeOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  const d = toDate(value);
  if (!d) return typeof value === "string" ? value : "—";
  return d.toLocaleString(PERTH_LOCALE, {
    timeZone: PERTH_TZ,
    ...options,
  });
}

/** Format a calendar date in Perth. */
export function formatPerthDate(
  value: string | Date,
  dateStyle: NonNullable<FormatPerthDateTimeOptions["dateStyle"]> = "medium",
): string {
  const d = toDate(value);
  if (!d) return typeof value === "string" ? value : "—";
  return d.toLocaleDateString(PERTH_LOCALE, {
    timeZone: PERTH_TZ,
    dateStyle,
  });
}

/** Short date + time in Perth (admin tables). */
export function formatPerthDateTimeShort(value: string | Date): string {
  return formatPerthDateTime(value, { dateStyle: "short", timeStyle: "short" });
}

function getPerthYmdUtcOffsetFallback(d: Date): { year: number; month: number; day: number; ymd: string } {
  const perthMs = d.getTime() + 8 * 60 * 60 * 1000;
  const p = new Date(perthMs);
  const year = p.getUTCFullYear();
  const month = p.getUTCMonth() + 1;
  const day = p.getUTCDate();
  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, ymd };
}

export function getPerthYmd(d = new Date()): { year: number; month: number; day: number; ymd: string } {
  try {
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: PERTH_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      return getPerthYmdUtcOffsetFallback(d);
    }
    const [y, m, day] = ymd.split("-").map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) {
      return getPerthYmdUtcOffsetFallback(d);
    }
    return { year: y, month: m, day, ymd };
  } catch {
    return getPerthYmdUtcOffsetFallback(d);
  }
}

export function isPerthDayOfMonth(d: Date, dayOfMonth: number): boolean {
  return getPerthYmd(d).day === dayOfMonth;
}

/** Inclusive month window for supplier report: YYYY-MM-01 .. YYYY-MM-25 in the given Perth calendar month. */
export function supplierReportMonthRange(year: number, month: number): { start: string; end: string } {
  const mm = String(month).padStart(2, "0");
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-25`,
  };
}

/** Add signed whole days to a calendar YYYY-MM-DD (no TZ shift; use for Perth labels only). */
export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** ISO weekday in Perth: Monday = 1 … Sunday = 7. */
export function perthWeekdayIsoNumericMon1Sun7(ymd: string): number {
  const d = new Date(`${ymd}T12:00:00+08:00`);
  const short = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: PERTH_TZ }).format(d);
  const key = short.slice(0, 3);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[key] ?? 1;
}

/** Calendar Monday `YYYY-MM-DD` (Perth) for the week that contains `ymd`. */
export function perthMondayYmdOfWeekContaining(ymd: string): string {
  const dow = perthWeekdayIsoNumericMon1Sun7(ymd);
  const daysBack = dow - 1;
  return addCalendarDaysYmd(ymd, -daysBack);
}

/**
 * Perth “today” through (dayCount − 1) days earlier, newest first.
 * Every calendar day in range is listed so the UI can render an empty sheet when there are no rows.
 */
export function getPerthDateSheetRangeDescending(dayCount: number, now = new Date()): string[] {
  const { ymd: today } = getPerthYmd(now);
  const start = addCalendarDaysYmd(today, -(dayCount - 1));
  const ascending: string[] = [];
  let cur = start;
  while (cur <= today) {
    ascending.push(cur);
    cur = addCalendarDaysYmd(cur, 1);
  }
  return ascending.reverse();
}

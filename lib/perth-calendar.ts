/** Calendar date parts in Australia/Perth (for admin reporting). */
export const PERTH_TZ = "Australia/Perth";

export function getPerthYmd(d = new Date()): { year: number; month: number; day: number; ymd: string } {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, day] = ymd.split("-").map((x) => Number(x));
  return { year: y, month: m, day, ymd };
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

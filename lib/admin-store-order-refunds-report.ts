import { getPerthYmd } from "@/lib/perth-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase";

import {
  perthDayEndIsoUtc,
  perthDayStartIsoUtc,
  STORE_ORDERS_TZ,
} from "@/app/admin/(panel)/store-orders/store-orders-list-helpers";

export type StoreOrderRefundReportRow = {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  total_cents: number;
  refunded_cents: number;
  refunded_at: string;
  currency: string;
  stripe_refund_id: string | null;
};

export type RefundPeriodTotal = {
  key: string;
  label: string;
  count: number;
  refundedCents: number;
};

export type StoreOrderRefundsReport = {
  rows: StoreOrderRefundReportRow[];
  truncated: boolean;
  loadError: string | null;
  summary: {
    today: RefundPeriodTotal;
    monthToDate: RefundPeriodTotal;
    quarterToDate: RefundPeriodTotal;
    yearToDate: RefundPeriodTotal;
    allLoaded: RefundPeriodTotal;
  };
  monthly: RefundPeriodTotal[];
  quarterly: RefundPeriodTotal[];
  annual: RefundPeriodTotal[];
  labels: {
    asOfPerthYmd: string;
    monthStartsYmd: string;
    quarterLabel: string;
    yearStartsYmd: string;
  };
};

const FETCH_LIMIT = 2500;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export type RefundsReportListQuery = {
  from: string;
  to: string;
  q: string;
};

export function parseRefundsReportListQuery(
  sp: Record<string, string | string[] | undefined>,
): RefundsReportListQuery {
  const g = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const from = YMD_RE.test(g("from")) ? g("from") : "";
  const to = YMD_RE.test(g("to")) ? g("to") : "";
  const q = g("q").slice(0, 120);
  return { from, to, q };
}

function perthYmdFromIso(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: STORE_ORDERS_TZ });
}

function monthKeyFromYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

function quarterKeyFromYmd(ymd: string): string {
  const month = Number(ymd.slice(5, 7));
  const year = ymd.slice(0, 4);
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

function quarterLabel(key: string): string {
  const [year, qPart] = key.split("-");
  return `${qPart} ${year}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1, 12));
  return d.toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" });
}

function emptyTotal(key: string, label: string): RefundPeriodTotal {
  return { key, label, count: 0, refundedCents: 0 };
}

function addToBucket(map: Map<string, RefundPeriodTotal>, key: string, label: string, cents: number) {
  const cur = map.get(key);
  if (cur) {
    cur.count += 1;
    cur.refundedCents += cents;
  } else {
    map.set(key, { key, label, count: 1, refundedCents: cents });
  }
}

function inYmdRange(ymd: string, fromYmd: string, toYmd: string): boolean {
  if (fromYmd && ymd < fromYmd) return false;
  if (toYmd && ymd > toYmd) return false;
  return true;
}

/** Stripe card refunds on store_orders — aggregates and list for Accounting → Refunds. */
export async function loadStoreOrderRefundsReport(
  listQuery: RefundsReportListQuery,
): Promise<StoreOrderRefundsReport> {
  const now = new Date();
  const { ymd: todayYmd, year, month } = getPerthYmd(now);
  const monthStartsYmd = `${year}-${String(month).padStart(2, "0")}-01`;
  const yearStartsYmd = `${year}-01-01`;
  const qNum = Math.ceil(month / 3);
  const quarterStartMonth = (qNum - 1) * 3 + 1;
  const quarterStartsYmd = `${year}-${String(quarterStartMonth).padStart(2, "0")}-01`;
  const quarterLabelText = `Q${qNum} ${year}`;
  const loadFromYear = year - 2;
  const loadFromYmd = `${loadFromYear}-01-01`;
  const loadFromIso = perthDayStartIsoUtc(loadFromYmd);

  const emptyReport = (): StoreOrderRefundsReport => ({
    rows: [],
    truncated: false,
    loadError: null,
    summary: {
      today: emptyTotal("today", `Today (${todayYmd})`),
      monthToDate: emptyTotal("mtd", "Month to date"),
      quarterToDate: emptyTotal("qtd", quarterLabelText),
      yearToDate: emptyTotal("ytd", `Year ${year}`),
      allLoaded: emptyTotal("all", "All on file"),
    },
    monthly: [],
    quarterly: [],
    annual: [],
    labels: {
      asOfPerthYmd: todayYmd,
      monthStartsYmd,
      quarterLabel: quarterLabelText,
      yearStartsYmd,
    },
  });

  try {
    const supabase = createSupabaseAdminClient();
    const selectCandidates = [
      "id, order_number, status, customer_email, customer_name, total_cents, refunded_cents, refunded_at, currency, stripe_refund_id",
      "id, order_number, status, customer_email, customer_name, total_cents, refunded_cents, refunded_at, currency",
    ] as const;

    let data: Record<string, unknown>[] | null = null;
    let error: { message?: string; code?: string } | null = null;

    for (const select of selectCandidates) {
      const result = await supabase
        .from("store_orders")
        .select(select)
        .gt("refunded_cents", 0)
        .not("refunded_at", "is", null)
        .gte("refunded_at", loadFromIso)
        .order("refunded_at", { ascending: false })
        .limit(FETCH_LIMIT);

      if (!result.error) {
        data = (result.data ?? []) as unknown as Record<string, unknown>[];
        error = null;
        break;
      }
      error = result.error as { message?: string; code?: string };
    }

    if (error) {
      const msg = error.message ?? "Load failed";
      const missing =
        msg.includes("refunded_cents") ||
        msg.includes("refunded_at") ||
        msg.includes("store_orders") ||
        error.code === "42703" ||
        error.code === "42P01";
      const report = emptyReport();
      report.loadError = missing
        ? "Refund columns missing. Run supabase/migrations/20260517_store_orders_stripe_refund.sql in Supabase, then reload schema."
        : msg;
      return report;
    }

    const allRows: StoreOrderRefundReportRow[] = (data ?? []).map((r) => ({
      id: String(r.id ?? ""),
      order_number: String(r.order_number ?? ""),
      status: String(r.status ?? ""),
      customer_name: String(r.customer_name ?? ""),
      customer_email: String(r.customer_email ?? ""),
      total_cents: Number(r.total_cents) || 0,
      refunded_cents: Number(r.refunded_cents) || 0,
      refunded_at: String(r.refunded_at ?? ""),
      currency: String(r.currency ?? "AUD"),
      stripe_refund_id:
        r.stripe_refund_id != null && String(r.stripe_refund_id).trim() !== ""
          ? String(r.stripe_refund_id)
          : null,
    }));

    const truncated = allRows.length >= FETCH_LIMIT;

    const monthlyMap = new Map<string, RefundPeriodTotal>();
    const quarterlyMap = new Map<string, RefundPeriodTotal>();
    const annualMap = new Map<string, RefundPeriodTotal>();

    const summary = {
      today: emptyTotal("today", `Today (${todayYmd})`),
      monthToDate: emptyTotal("mtd", "Month to date"),
      quarterToDate: emptyTotal("qtd", quarterLabelText),
      yearToDate: emptyTotal("ytd", `Year ${year}`),
      allLoaded: emptyTotal("all", `Since ${loadFromYmd}`),
    };

    for (const row of allRows) {
      const ymd = perthYmdFromIso(row.refunded_at);
      if (!ymd) continue;
      const cents = row.refunded_cents;

      summary.allLoaded.count += 1;
      summary.allLoaded.refundedCents += cents;

      if (ymd === todayYmd) {
        summary.today.count += 1;
        summary.today.refundedCents += cents;
      }
      if (ymd >= monthStartsYmd && ymd <= todayYmd) {
        summary.monthToDate.count += 1;
        summary.monthToDate.refundedCents += cents;
      }
      if (ymd >= quarterStartsYmd && ymd <= todayYmd) {
        summary.quarterToDate.count += 1;
        summary.quarterToDate.refundedCents += cents;
      }
      if (ymd >= yearStartsYmd && ymd <= todayYmd) {
        summary.yearToDate.count += 1;
        summary.yearToDate.refundedCents += cents;
      }

      const mKey = monthKeyFromYmd(ymd);
      addToBucket(monthlyMap, mKey, monthLabel(mKey), cents);

      const qKey = quarterKeyFromYmd(ymd);
      addToBucket(quarterlyMap, qKey, quarterLabel(qKey), cents);

      const yKey = ymd.slice(0, 4);
      addToBucket(annualMap, yKey, yKey, cents);
    }

    const searchTerm = listQuery.q.replace(/[%*,()]/g, "").trim().toLowerCase();
    const listFromYmd = listQuery.from || defaultRefundsListFromYmd(todayYmd);
    const listToYmd = listQuery.to || todayYmd;
    let filtered = allRows.filter((row) => {
      const ymd = perthYmdFromIso(row.refunded_at);
      return ymd ? inYmdRange(ymd, listFromYmd, listToYmd) : false;
    });
    if (searchTerm.length > 0) {
      filtered = filtered.filter((row) => {
        const hay = `${row.order_number} ${row.customer_email} ${row.customer_name} ${row.id}`.toLowerCase();
        return hay.includes(searchTerm);
      });
    }

    const sortDesc = (a: RefundPeriodTotal, b: RefundPeriodTotal) => b.key.localeCompare(a.key);

    return {
      rows: filtered,
      truncated,
      loadError: null,
      summary,
      monthly: [...monthlyMap.values()].sort(sortDesc),
      quarterly: [...quarterlyMap.values()].sort(sortDesc),
      annual: [...annualMap.values()].sort(sortDesc),
      labels: {
        asOfPerthYmd: todayYmd,
        monthStartsYmd,
        quarterLabel: quarterLabelText,
        yearStartsYmd,
      },
    };
  } catch (e) {
    const report = emptyReport();
    report.loadError = e instanceof Error ? e.message : "Could not load refunds.";
    return report;
  }
}

export function buildRefundsReportHref(query: RefundsReportListQuery): string {
  const p = new URLSearchParams();
  if (query.from) p.set("from", query.from);
  if (query.to) p.set("to", query.to);
  if (query.q) p.set("q", query.q);
  const s = p.toString();
  return s ? `/admin/accounting/refunds?${s}` : "/admin/accounting/refunds";
}

export function formatRefundDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-AU", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: STORE_ORDERS_TZ,
    });
  } catch {
    return "—";
  }
}

export function formatRefundDate(iso: string): string {
  const ymd = perthYmdFromIso(iso);
  if (!ymd) return "—";
  try {
    const d = new Date(`${ymd}T12:00:00+08:00`);
    return d.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: STORE_ORDERS_TZ,
    });
  } catch {
    return ymd;
  }
}

/** Default list window: last 90 days of refunds (Perth). */
export function defaultRefundsListFromYmd(asOfYmd: string): string {
  const [y, m, d] = asOfYmd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 89);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export { perthDayEndIsoUtc, perthDayStartIsoUtc };

/** Perth (AWST, no DST) — matches list grouping. */
export const STORE_ORDERS_TZ = "Australia/Perth";

/** Default calendar-day window when no from/to filter (matches Supplier orders). */
export const ADMIN_STORE_ORDER_DAY_WINDOW = 60;

/** Safety cap when loading orders for the list. */
export const STORE_ORDERS_FETCH_LIMIT = 2000;

/** Day groups shown per screen (matches Supplier orders). */
export const STORE_ORDERS_DAYS_PER_PAGE = 7;

export type StoreOrderShipFilter = "all" | "pending" | "shipped";

export type StoreOrderListQuery = {
  ship: StoreOrderShipFilter;
  from: string;
  to: string;
  q: string;
};

export type StoreOrderListRow = {
  id: string;
  order_number: string;
  status: string;
  customer_email: string;
  customer_name: string;
  total_cents: number;
  delivery_fee_cents: number;
  currency: string;
  tracking_number: string | null;
  created_at: string;
  invoice_reference: string | null;
  hold_process: boolean;
  hold_note: string | null;
  refunded_cents: number;
  refunded_at: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
};

export type StoreOrderDayGroup = {
  dayKey: string;
  dayHeading: string;
  orders: StoreOrderListRow[];
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseStoreOrderListQuery(sp: Record<string, string | string[] | undefined>): StoreOrderListQuery {
  const g = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const shipRaw = g("ship").toLowerCase();
  const ship: StoreOrderShipFilter =
    shipRaw === "pending" || shipRaw === "shipped" ? shipRaw : "all";
  const from = YMD_RE.test(g("from")) ? g("from") : "";
  const to = YMD_RE.test(g("to")) ? g("to") : "";
  const q = g("q").slice(0, 120);
  return { ship, from, to, q };
}

export function buildStoreOrdersListHref(
  basePath: string,
  query: StoreOrderListQuery,
  patch?: Partial<StoreOrderListQuery>,
): string {
  const next = { ...query, ...patch };
  const p = new URLSearchParams();
  if (next.ship !== "all") {
    p.set("ship", next.ship);
  }
  if (next.from) {
    p.set("from", next.from);
  }
  if (next.to) {
    p.set("to", next.to);
  }
  if (next.q) {
    p.set("q", next.q);
  }
  const s = p.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Inclusive start of calendar day in Perth, as UTC ISO for `created_at` filter. */
export function perthDayStartIsoUtc(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T00:00:00+08:00`).toISOString();
}

/** Inclusive end of calendar day in Perth. */
export function perthDayEndIsoUtc(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T23:59:59.999+08:00`).toISOString();
}

export function perthTodayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: STORE_ORDERS_TZ });
}

export function perthCalendarAddDays(ymd: string, deltaDays: number): string {
  const t = new Date(`${ymd}T00:00:00+08:00`);
  t.setUTCDate(t.getUTCDate() + deltaDays);
  return t.toLocaleDateString("en-CA", { timeZone: STORE_ORDERS_TZ });
}

export function resolveStoreOrdersListDateRange(query: StoreOrderListQuery): { fromYmd: string; toYmd: string } {
  const today = perthTodayYmd();
  const fromYmd =
    query.from || perthCalendarAddDays(today, -(ADMIN_STORE_ORDER_DAY_WINDOW - 1));
  const toYmd = query.to || today;
  return { fromYmd, toYmd };
}

function parseOrderDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function calendarDayKey(iso: string): string {
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

export function formatStoreOrderDayHeading(sampleIso: string): string {
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

export function formatPaymentDateForXero(iso: string): string {
  try {
    const d = parseOrderDate(iso);
    if (!d) {
      return "—";
    }
    return d.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: STORE_ORDERS_TZ,
    });
  } catch {
    return "—";
  }
}

export function formatOrderRowDateTime(iso: string): string {
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

export function groupStoreOrdersByCalendarDay(rows: StoreOrderListRow[]): StoreOrderDayGroup[] {
  const map = new Map<string, StoreOrderListRow[]>();
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
    .map(([dayKey, orders]) => ({
      dayKey,
      dayHeading: formatStoreOrderDayHeading(orders[0]!.created_at),
      orders,
    }));
}

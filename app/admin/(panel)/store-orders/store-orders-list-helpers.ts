/** Perth (AWST, no DST) — matches list grouping. */
export const STORE_ORDERS_TZ = "Australia/Perth";

export const STORE_ORDERS_PAGE_SIZE = 50;

export type StoreOrderShipFilter = "all" | "pending" | "shipped";

export type StoreOrderListQuery = {
  ship: StoreOrderShipFilter;
  from: string;
  to: string;
  q: string;
  page: number;
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
  const pageRaw = Number.parseInt(g("page"), 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  return { ship, from, to, q, page };
}

export function buildStoreOrdersListHref(query: StoreOrderListQuery, patch?: Partial<StoreOrderListQuery>): string {
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
  if (next.page > 1) {
    p.set("page", String(next.page));
  }
  const s = p.toString();
  return s ? `/admin/store-orders?${s}` : "/admin/store-orders";
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

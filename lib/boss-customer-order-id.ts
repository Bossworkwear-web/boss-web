import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getPerthYmd } from "@/lib/perth-calendar";

/** Public customer-facing order id: `BOS_YYYYMMDD_001` (Perth calendar date, daily sequence). */
export const BOSS_CUSTOMER_ORDER_PREFIX = "BOS_";

/**
 * Build a BOS id for a Perth worksheet date and 1-based sequence within that day (e.g. supplier demo rows).
 * @param perthYmd - `YYYY-MM-DD` (Perth calendar)
 */
export function bossCustomerOrderId(perthYmd: string, dailySeq: number): string {
  const compact = perthYmd.replace(/-/g, "");
  const n = Math.max(1, Math.floor(dailySeq));
  const width = n < 1000 ? 3 : String(n).length;
  return `${BOSS_CUSTOMER_ORDER_PREFIX}${compact}_${String(n).padStart(width, "0")}`;
}

/**
 * Next store order number for checkout: `BOS_` + Perth today + next free sequence for that date prefix.
 */
export async function allocateNextBossStoreOrderNumber(
  supabase: SupabaseClient<Database>,
): Promise<{ ok: true; orderNumber: string } | { ok: false; error: string }> {
  const { ymd } = getPerthYmd(new Date());
  const compact = ymd.replace(/-/g, "");
  const prefix = `${BOSS_CUSTOMER_ORDER_PREFIX}${compact}_`;

  const { data, error } = await supabase
    .from("store_orders")
    .select("order_number")
    .like("order_number", `${prefix}%`)
    .order("order_number", { ascending: false })
    .limit(1);

  if (error) {
    return { ok: false, error: error.message };
  }

  let next = 1;
  const last = data?.[0]?.order_number;
  if (last?.startsWith(prefix)) {
    const tail = last.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }

  if (next > 99999) {
    return { ok: false, error: "Daily order number limit reached." };
  }

  const width = next < 1000 ? 3 : String(next).length;
  return { ok: true, orderNumber: `${prefix}${String(next).padStart(width, "0")}` };
}

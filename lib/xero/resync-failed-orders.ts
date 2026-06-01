import { createSupabaseAdminClient } from "@/lib/supabase";
import { syncStoreOrderToXero } from "@/lib/xero/sync-store-order";

export type ResyncFailedXeroOrdersResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  /** Set when the run stopped early because the Xero connection itself is broken/missing. */
  connectionBlocked: boolean;
  errors: { orderNumber: string; error: string }[];
};

/**
 * Re-push paid store orders that never made it into Xero (no `xero_invoice_id`). Used by the admin
 * "Resync" button and the periodic cron. If the very first order fails because the connection is
 * broken (e.g. invalid_client) or missing, the run stops early so we do not hammer Xero pointlessly.
 */
export async function resyncFailedXeroOrders(opts?: {
  maxOrders?: number;
  sinceDays?: number;
}): Promise<ResyncFailedXeroOrdersResult> {
  const maxOrders = Math.min(Math.max(1, opts?.maxOrders ?? 50), 200);
  const result: ResyncFailedXeroOrdersResult = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    connectionBlocked: false,
    errors: [],
  };

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch (e) {
    result.errors.push({ orderNumber: "—", error: e instanceof Error ? e.message : "Database not configured." });
    return result;
  }

  let query = supabase
    .from("store_orders")
    .select("id, order_number, created_at")
    .eq("status", "paid")
    .is("xero_invoice_id", null)
    .order("created_at", { ascending: true })
    .limit(maxOrders);

  if (opts?.sinceDays && opts.sinceDays > 0) {
    const since = new Date(Date.now() - opts.sinceDays * 86_400_000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) {
    result.errors.push({ orderNumber: "—", error: error.message });
    return result;
  }

  for (const row of data ?? []) {
    result.attempted += 1;
    const label = (row.order_number ?? "").trim() || row.id;
    try {
      const res = await syncStoreOrderToXero(row.id);
      if (res.ok) {
        result.succeeded += 1;
      } else if (res.skipped) {
        // "Not connected" / missing invoice scope — connection-level problem, stop early.
        result.skipped += 1;
        result.connectionBlocked = true;
        result.errors.push({ orderNumber: label, error: res.error });
        break;
      } else {
        result.failed += 1;
        result.errors.push({ orderNumber: label, error: res.error });
      }
    } catch (e) {
      // An exception (e.g. invalid_client during token refresh) affects every order — stop early.
      result.failed += 1;
      result.connectionBlocked = true;
      result.errors.push({ orderNumber: label, error: e instanceof Error ? e.message : "Xero sync failed" });
      break;
    }
  }

  return result;
}

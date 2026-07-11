import { createSupabaseAdminClient } from "@/lib/supabase";
import { refreshSyncedOrderXeroContactName } from "@/lib/xero/sync-store-order";

export type RefreshXeroContactNamesResult = {
  attempted: number;
  updated: number;
  failed: number;
  errors: { orderNumber: string; error: string }[];
};

/**
 * Rename Xero contacts on already-synced store invoices to Company Name
 * (`customer_profiles.organisation`) when available. Safe to re-run.
 */
export async function refreshSyncedXeroInvoiceContactNames(opts?: {
  maxOrders?: number;
}): Promise<RefreshXeroContactNamesResult> {
  const maxOrders = Math.min(Math.max(1, opts?.maxOrders ?? 100), 300);
  const result: RefreshXeroContactNamesResult = {
    attempted: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch (e) {
    result.errors.push({
      orderNumber: "—",
      error: e instanceof Error ? e.message : "Database not configured.",
    });
    return result;
  }

  const { data, error } = await supabase
    .from("store_orders")
    .select("id, order_number")
    .not("xero_invoice_id", "is", null)
    .not("xero_contact_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(maxOrders);

  if (error) {
    result.errors.push({ orderNumber: "—", error: error.message });
    return result;
  }

  for (const row of data ?? []) {
    result.attempted += 1;
    const label = (row.order_number ?? "").trim() || row.id;
    const res = await refreshSyncedOrderXeroContactName(row.id);
    if (res.ok) {
      result.updated += 1;
    } else {
      result.failed += 1;
      result.errors.push({ orderNumber: label, error: res.error ?? "Update failed" });
    }
  }

  return result;
}

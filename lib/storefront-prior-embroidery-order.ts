import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/** Escape `%` / `_` / `\` for Postgres `ILIKE` exact match (same pattern as customer account page). */
export function escapeForIlikeExact(email: string): string {
  return email.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function hasPriorEmbroideryOrderForCustomerEmail(
  supabase: SupabaseClient<Database>,
  sessionEmail: string,
): Promise<boolean> {
  const trimmed = sessionEmail.trim();
  if (!trimmed) {
    return false;
  }
  const ilikeExact = escapeForIlikeExact(trimmed);
  const { data: orders } = await supabase
    .from("store_orders")
    .select("id")
    .ilike("customer_email", ilikeExact)
    .limit(500);

  const ids = (orders ?? []).map((o) => o.id).filter(Boolean);
  if (ids.length === 0) {
    return false;
  }

  const { data: lines } = await supabase
    .from("store_order_items")
    .select("service_type")
    .in("order_id", ids)
    .limit(4000);

  return (lines ?? []).some((row) => (row.service_type ?? "").toLowerCase().includes("embroidery"));
}

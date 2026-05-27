import { createSupabaseAdminClient } from "@/lib/supabase";

export type StoreCreditLedgerRow = {
  id: string;
  customer_email: string;
  amount_cents: number;
  balance_after_cents: number;
  kind: string;
  source_store_order_id: string | null;
  store_order_id: string | null;
  note: string | null;
  created_at: string;
};

export async function loadStoreCreditAdminSummary(): Promise<{
  totalOutstandingCents: number;
  recentIssues: StoreCreditLedgerRow[];
  loadError: string | null;
}> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data: balances, error: balErr } = await supabase
      .from("customer_store_credit_balances")
      .select("balance_cents");

    if (balErr) {
      if (balErr.message.includes("customer_store_credit")) {
        return { totalOutstandingCents: 0, recentIssues: [], loadError: null };
      }
      return { totalOutstandingCents: 0, recentIssues: [], loadError: balErr.message };
    }

    const totalOutstandingCents = (balances ?? []).reduce(
      (sum, row) => sum + Math.max(0, row.balance_cents ?? 0),
      0,
    );

    const { data: recent, error: recentErr } = await supabase
      .from("customer_store_credit_ledger")
      .select(
        "id, customer_email, amount_cents, balance_after_cents, kind, source_store_order_id, store_order_id, note, created_at",
      )
      .eq("kind", "issue")
      .order("created_at", { ascending: false })
      .limit(25);

    if (recentErr) {
      return { totalOutstandingCents, recentIssues: [], loadError: recentErr.message };
    }

    return {
      totalOutstandingCents,
      recentIssues: (recent ?? []) as StoreCreditLedgerRow[],
      loadError: null,
    };
  } catch (e) {
    return {
      totalOutstandingCents: 0,
      recentIssues: [],
      loadError: e instanceof Error ? e.message : "Could not load store credit.",
    };
  }
}

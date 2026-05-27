import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type AdminClient = SupabaseClient<Database>;

export function normalizeStoreCreditEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getCustomerStoreCreditBalanceCents(
  supabase: AdminClient,
  customerEmail: string,
): Promise<number> {
  const email = normalizeStoreCreditEmail(customerEmail);
  if (!email) return 0;

  const { data, error } = await supabase
    .from("customer_store_credit_balances")
    .select("balance_cents")
    .eq("customer_email", email)
    .maybeSingle();

  if (error) {
    if (error.message.includes("customer_store_credit_balances")) {
      return 0;
    }
    throw new Error(error.message);
  }

  return Math.max(0, data?.balance_cents ?? 0);
}

export async function getStoreCreditIssuedForOrderCents(
  supabase: AdminClient,
  sourceStoreOrderId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("customer_store_credit_ledger")
    .select("amount_cents")
    .eq("source_store_order_id", sourceStoreOrderId)
    .eq("kind", "issue");

  if (error) {
    if (error.message.includes("customer_store_credit_ledger")) {
      return 0;
    }
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, row) => sum + Math.max(0, row.amount_cents ?? 0), 0);
}

export async function issueCustomerStoreCredit(
  supabase: AdminClient,
  args: {
    customerEmail: string;
    amountCents: number;
    sourceStoreOrderId?: string | null;
    note?: string | null;
    createdBy?: string | null;
  },
): Promise<{ ok: true; balanceCents: number } | { ok: false; error: string }> {
  const email = normalizeStoreCreditEmail(args.customerEmail);
  if (!email) {
    return { ok: false, error: "Customer email is required." };
  }
  if (!Number.isFinite(args.amountCents) || args.amountCents < 1) {
    return { ok: false, error: "Credit amount must be at least A$0.01." };
  }

  const { data, error } = await supabase.rpc("issue_customer_store_credit", {
    p_email: email,
    p_amount_cents: Math.round(args.amountCents),
    p_source_store_order_id: args.sourceStoreOrderId?.trim() || undefined,
    p_note: args.note?.trim() || undefined,
    p_created_by: args.createdBy?.trim() || undefined,
  });

  if (error) {
    const msg = error.message ?? "Could not issue store credit.";
    if (msg.includes("customer_store_credit")) {
      return {
        ok: false,
        error:
          "Store credit tables missing. Run supabase/migrations/20260527_customer_store_credit.sql in Supabase, then reload schema.",
      };
    }
    return { ok: false, error: msg };
  }

  return { ok: true, balanceCents: typeof data === "number" ? data : Number(data) || 0 };
}

export async function redeemCustomerStoreCredit(
  supabase: AdminClient,
  args: {
    customerEmail: string;
    amountCents: number;
    storeOrderId: string;
  },
): Promise<{ ok: true; balanceCents: number } | { ok: false; error: string }> {
  const email = normalizeStoreCreditEmail(args.customerEmail);
  if (!email) {
    return { ok: false, error: "Customer email is required." };
  }
  if (!Number.isFinite(args.amountCents) || args.amountCents < 1) {
    return { ok: false, error: "Invalid credit amount." };
  }
  const orderId = args.storeOrderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { ok: false, error: "Invalid order id." };
  }

  const { data, error } = await supabase.rpc("redeem_customer_store_credit", {
    p_email: email,
    p_amount_cents: Math.round(args.amountCents),
    p_store_order_id: orderId,
  });

  if (error) {
    const msg = error.message ?? "Could not redeem store credit.";
    if (msg.toLowerCase().includes("insufficient")) {
      return { ok: false, error: "Insufficient store credit balance." };
    }
    return { ok: false, error: msg };
  }

  return { ok: true, balanceCents: typeof data === "number" ? data : Number(data) || 0 };
}

/** How much credit can apply to an order total (cents). */
export function computeStoreCreditToApplyCents(balanceCents: number, orderTotalCents: number): number {
  const balance = Math.max(0, Math.floor(balanceCents));
  const total = Math.max(0, Math.floor(orderTotalCents));
  if (balance <= 0 || total <= 0) return 0;
  return Math.min(balance, total);
}

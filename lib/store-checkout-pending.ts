import type { SupabaseClient } from "@supabase/supabase-js";

import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";

export type StoreCheckoutPendingRow = {
  id: string;
  stripe_checkout_session_id: string;
  customer_email: string;
  customer_name: string;
  delivery_address: string;
  cart_payload: StoreOrderCartLine[];
  promotion_code_id: string | null;
  pick_up: boolean;
  reordered_from_store_order_id: string | null;
  store_credit_applied_cents: number;
  status: "pending" | "fulfilled";
  store_order_id: string | null;
};

export type SaveStoreCheckoutPendingInput = {
  stripeCheckoutSessionId: string;
  customerEmail: string;
  customerName: string;
  deliveryAddress: string;
  items: StoreOrderCartLine[];
  promotionCodeId?: string | null;
  pickUp?: boolean;
  reorderedFromStoreOrderId?: string | null;
  storeCreditAppliedCents?: number;
};

export async function saveStoreCheckoutPending(
  supabase: SupabaseClient,
  input: SaveStoreCheckoutPendingInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const stripeCheckoutSessionId = input.stripeCheckoutSessionId.trim();
  if (!stripeCheckoutSessionId.startsWith("cs_")) {
    return { ok: false, error: "Invalid Stripe Checkout session id." };
  }

  const { error } = await supabase.from("store_checkout_pending").upsert(
    {
      stripe_checkout_session_id: stripeCheckoutSessionId,
      customer_email: input.customerEmail.trim().toLowerCase(),
      customer_name: input.customerName.trim(),
      delivery_address: input.deliveryAddress.trim(),
      cart_payload: input.items,
      promotion_code_id: input.promotionCodeId?.trim() || null,
      pick_up: input.pickUp === true,
      reordered_from_store_order_id: input.reorderedFromStoreOrderId?.trim() || null,
      store_credit_applied_cents: Math.max(0, Math.round(input.storeCreditAppliedCents ?? 0)),
      status: "pending",
      store_order_id: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_checkout_session_id" },
  );

  if (error) {
    return { ok: false, error: error.message || "Could not save checkout snapshot." };
  }
  return { ok: true };
}

export async function getStoreCheckoutPendingBySessionId(
  supabase: SupabaseClient,
  stripeCheckoutSessionId: string,
): Promise<StoreCheckoutPendingRow | null> {
  const sessionId = stripeCheckoutSessionId.trim();
  if (!sessionId.startsWith("cs_")) {
    return null;
  }

  const { data, error } = await supabase
    .from("store_checkout_pending")
    .select(
      "id, stripe_checkout_session_id, customer_email, customer_name, delivery_address, cart_payload, promotion_code_id, pick_up, reordered_from_store_order_id, store_credit_applied_cents, status, store_order_id",
    )
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as StoreCheckoutPendingRow;
  const items = Array.isArray(row.cart_payload) ? row.cart_payload : [];
  return { ...row, cart_payload: items };
}

export async function markStoreCheckoutPendingFulfilled(
  supabase: SupabaseClient,
  stripeCheckoutSessionId: string,
  storeOrderId: string,
): Promise<void> {
  await supabase
    .from("store_checkout_pending")
    .update({
      status: "fulfilled",
      store_order_id: storeOrderId,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_checkout_session_id", stripeCheckoutSessionId.trim());
}

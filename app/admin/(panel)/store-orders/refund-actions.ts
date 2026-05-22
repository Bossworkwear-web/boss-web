"use server";

import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import {
  createStripeRefundForPaymentIntent,
  retrievePaidCheckoutSession,
  retrievePaidPaymentIntent,
} from "@/lib/store-order-stripe";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type StoreOrderRefundActionResult = { ok: true } | { ok: false; error: string };

type OrderStripeRow = {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  refunded_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
};

async function loadOrderForRefund(orderId: string): Promise<
  | { ok: true; order: OrderStripeRow; supabase: ReturnType<typeof createSupabaseAdminClient> }
  | { ok: false; error: string }
> {
  const id = orderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid order." };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Database not configured." };
  }

  const { data, error } = await supabase
    .from("store_orders")
    .select(
      "id, order_number, status, total_cents, refunded_cents, stripe_checkout_session_id, stripe_payment_intent_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("stripe_checkout_session_id") || error.code === "42703") {
      return {
        ok: false,
        error:
          "Refund columns missing. Run supabase/migrations/20260517_store_orders_stripe_refund.sql in Supabase SQL Editor, then reload schema.",
      };
    }
    return { ok: false, error: msg || "Could not load order." };
  }
  if (!data) {
    return { ok: false, error: "Order not found." };
  }

  return { ok: true, order: data as OrderStripeRow, supabase };
}

function revalidateStoreOrderPaths(orderId: string) {
  revalidatePath("/admin/store-orders", "page");
  revalidatePath(`/admin/store-orders/${orderId}/ordered-items-list`);
}

/** Attach a paid Stripe Checkout session (`cs_…`) or Payment Intent (`pi_…`) to an order. */
export async function linkStoreOrderStripeCheckoutSession(
  orderId: string,
  stripeIdRaw: string,
): Promise<StoreOrderRefundActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const loaded = await loadOrderForRefund(orderId);
  if (!loaded.ok) {
    return loaded;
  }
  const { order, supabase } = loaded;

  const stripeId = stripeIdRaw.trim();
  let paymentIntentId: string;
  let checkoutSessionId: string | null = null;
  let amountTotalCents = 0;

  if (stripeId.startsWith("cs_")) {
    const sessionRes = await retrievePaidCheckoutSession(stripeId);
    if (!sessionRes.ok) {
      return { ok: false, error: sessionRes.error };
    }
    paymentIntentId = sessionRes.info.paymentIntentId;
    checkoutSessionId = sessionRes.info.sessionId;
    amountTotalCents = sessionRes.info.amountTotalCents;
  } else if (stripeId.startsWith("pi_")) {
    const piRes = await retrievePaidPaymentIntent(stripeId);
    if (!piRes.ok) {
      return { ok: false, error: piRes.error };
    }
    paymentIntentId = piRes.info.paymentIntentId;
    checkoutSessionId = piRes.info.checkoutSessionId;
    amountTotalCents = piRes.info.amountTotalCents;
  } else {
    return { ok: false, error: "Enter a Checkout session (cs_…) or Payment ID (pi_…) from Stripe." };
  }

  if (order.total_cents > 0 && amountTotalCents > 0 && amountTotalCents !== order.total_cents) {
    return {
      ok: false,
      error: `Stripe charged ${(amountTotalCents / 100).toFixed(2)} AUD but order total is ${(order.total_cents / 100).toFixed(2)} AUD. Check the id.`,
    };
  }

  if (checkoutSessionId) {
    const { data: otherSession } = await supabase
      .from("store_orders")
      .select("id, order_number")
      .eq("stripe_checkout_session_id", checkoutSessionId)
      .neq("id", order.id)
      .maybeSingle();

    if (otherSession?.id) {
      return {
        ok: false,
        error: `This Checkout session is already linked to order ${otherSession.order_number ?? otherSession.id}.`,
      };
    }
  }

  const { data: otherPi } = await supabase
    .from("store_orders")
    .select("id, order_number")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .neq("id", order.id)
    .maybeSingle();

  if (otherPi?.id) {
    return {
      ok: false,
      error: `This payment is already linked to order ${otherPi.order_number ?? otherPi.id}.`,
    };
  }

  const { error: updateErr } = await supabase
    .from("store_orders")
    .update({
      stripe_payment_intent_id: paymentIntentId,
      ...(checkoutSessionId ? { stripe_checkout_session_id: checkoutSessionId } : {}),
    })
    .eq("id", order.id);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  revalidateStoreOrderPaths(order.id);
  return { ok: true };
}

/** Refund to the customer's card via Stripe (full or partial). */
export async function refundStoreOrderViaStripe(
  orderId: string,
  options?: { amountCents?: number },
): Promise<StoreOrderRefundActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const loaded = await loadOrderForRefund(orderId);
  if (!loaded.ok) {
    return loaded;
  }
  const { order, supabase } = loaded;

  if (order.status === "unpaid") {
    return { ok: false, error: "This order was not paid online." };
  }

  const paymentIntentId = (order.stripe_payment_intent_id ?? "").trim();
  if (!paymentIntentId) {
    return {
      ok: false,
      error: "No Stripe payment on file. Link a Checkout session id (cs_…) below, then refund.",
    };
  }

  const alreadyRefunded = Math.max(0, order.refunded_cents ?? 0);
  const refundable = order.total_cents - alreadyRefunded;
  if (refundable <= 0) {
    return { ok: false, error: "This order is already fully refunded." };
  }

  const requested =
    options?.amountCents != null && Number.isFinite(options.amountCents)
      ? Math.round(options.amountCents)
      : refundable;

  if (requested < 1 || requested > refundable) {
    return {
      ok: false,
      error: `Refund must be between A$0.01 and A$${(refundable / 100).toFixed(2)}.`,
    };
  }

  const refundRes = await createStripeRefundForPaymentIntent({
    paymentIntentId,
    amountCents: requested,
    metadata: {
      store_order_id: order.id,
      order_number: order.order_number,
    },
  });

  if (!refundRes.ok) {
    return { ok: false, error: refundRes.error };
  }

  const newRefundedTotal = alreadyRefunded + refundRes.amountCents;
  const fullyRefunded = newRefundedTotal >= order.total_cents;

  const { error: updateErr } = await supabase
    .from("store_orders")
    .update({
      refunded_cents: newRefundedTotal,
      refunded_at: new Date().toISOString(),
      stripe_refund_id: refundRes.refundId,
      ...(fullyRefunded ? { status: "refunded" } : {}),
    })
    .eq("id", order.id);

  if (updateErr) {
    return {
      ok: false,
      error: `Stripe refund ${refundRes.refundId} succeeded but order update failed: ${updateErr.message}. Update the order in Supabase manually.`,
    };
  }

  try {
    const { syncStoreOrderRefundToXero } = await import("@/lib/xero/sync-store-order-refund");
    await syncStoreOrderRefundToXero({
      storeOrderId: order.id,
      stripeRefundId: refundRes.refundId,
      amountCents: refundRes.amountCents,
      refundedAt: new Date().toISOString(),
    });
  } catch {
    // Stripe refund succeeded; Xero credit note can be retried from admin sync.
  }

  revalidateStoreOrderPaths(order.id);
  return { ok: true };
}

import {
  findStoreOrderByStripeCheckoutSession,
  placeStoreOrderCore,
  type PlaceStoreOrderResult,
} from "@/lib/place-store-order-core";
import { getStoreCheckoutPendingBySessionId } from "@/lib/store-checkout-pending";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type FulfillStripeCheckoutResult = PlaceStoreOrderResult;

/** Create a paid store order from a completed Stripe Checkout session (webhook or recovery). */
export async function fulfillStoreOrderFromStripeCheckoutSession(
  stripeCheckoutSessionId: string,
): Promise<FulfillStripeCheckoutResult> {
  const sessionId = stripeCheckoutSessionId.trim();
  if (!sessionId.startsWith("cs_")) {
    return { ok: false, error: "Invalid Stripe Checkout session id." };
  }

  const existing = await findStoreOrderByStripeCheckoutSession(sessionId);
  if (existing) {
    const { siteBaseUrl } = await import("@/lib/store-order-utils");
    return {
      ok: true,
      orderNumber: existing.orderNumber,
      trackingToken: existing.trackingToken,
      trackUrl: `${siteBaseUrl()}/orders/track/${existing.trackingToken}`,
      orderId: existing.orderId,
    };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Orders are temporarily unavailable (database not configured)." };
  }

  const pending = await getStoreCheckoutPendingBySessionId(supabase, sessionId);
  if (!pending) {
    return {
      ok: false,
      error: "No checkout snapshot found for this Stripe session. The customer may need to open the payment confirmation page once.",
    };
  }

  if (pending.status === "fulfilled" && pending.store_order_id) {
    const { data } = await supabase
      .from("store_orders")
      .select("id, order_number, tracking_token")
      .eq("id", pending.store_order_id)
      .maybeSingle();
    if (data?.tracking_token) {
      const { siteBaseUrl } = await import("@/lib/store-order-utils");
      return {
        ok: true,
        orderNumber: data.order_number ?? data.id,
        trackingToken: data.tracking_token,
        trackUrl: `${siteBaseUrl()}/orders/track/${data.tracking_token}`,
        orderId: data.id,
      };
    }
  }

  return placeStoreOrderCore({
    customerEmail: pending.customer_email,
    customerName: pending.customer_name,
    deliveryAddress: pending.delivery_address,
    items: pending.cart_payload,
    options: {
      stripeCheckoutSessionId: sessionId,
      allowExistingStripeSession: true,
      promotionCodeId: pending.promotion_code_id ?? undefined,
      pickUp: pending.pick_up,
      reorderedFromStoreOrderId: pending.reordered_from_store_order_id ?? undefined,
    },
  });
}

import type Stripe from "stripe";

import { fulfillStoreOrderFromStripeCheckoutSession } from "@/lib/fulfill-stripe-checkout-order";
import { getStripeServer } from "@/lib/stripe-server";

export const STRIPE_WEBHOOK_CHECKOUT_COMPLETED = "checkout.session.completed";

export function isStripeCheckoutCompletedEvent(
  event: Pick<Stripe.Event, "type">,
): event is Stripe.Event & { type: typeof STRIPE_WEBHOOK_CHECKOUT_COMPLETED } {
  return event.type === STRIPE_WEBHOOK_CHECKOUT_COMPLETED;
}

export function shouldFulfillStripeCheckoutSession(
  session: Pick<Stripe.Checkout.Session, "payment_status" | "id">,
): boolean {
  return session.payment_status === "paid" && typeof session.id === "string" && session.id.startsWith("cs_");
}

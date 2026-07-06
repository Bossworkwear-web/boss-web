import Stripe from "stripe";

import { fulfillStoreOrderFromStripeCheckoutSession } from "@/lib/fulfill-stripe-checkout-order";
import { getStripeServer } from "@/lib/stripe-server";
import {
  isStripeCheckoutCompletedEvent,
  shouldFulfillStripeCheckoutSession,
} from "@/lib/stripe-webhook-handlers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripeServer();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !webhookSecret) {
    return Response.json({ ok: false, error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ ok: false, error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe webhook signature.";
    console.error("[stripe/webhook] signature:", message);
    return Response.json({ ok: false, error: message }, { status: 400 });
  }

  if (isStripeCheckoutCompletedEvent(event)) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (shouldFulfillStripeCheckoutSession(session)) {
      const result = await fulfillStoreOrderFromStripeCheckoutSession(session.id);
      if (!result.ok) {
        console.error("[stripe/webhook] fulfill:", session.id, result.error);
        const noRetry =
          result.error.includes("already recorded") ||
          result.error.includes("Invalid Stripe Checkout session") ||
          result.error.includes("No checkout snapshot");
        if (!noRetry) {
          return Response.json({ ok: false, error: result.error }, { status: 500 });
        }
      }
    }
  }

  return Response.json({ ok: true, received: true });
}

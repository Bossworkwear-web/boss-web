import type Stripe from "stripe";

import { getStripeServer } from "@/lib/stripe-server";

export type PaidCheckoutSessionInfo = {
  sessionId: string;
  paymentIntentId: string;
  amountTotalCents: number;
};

export type RetrievePaidCheckoutResult =
  | { ok: true; info: PaidCheckoutSessionInfo }
  | { ok: false; error: string };

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string" && pi.startsWith("pi_")) {
    return pi;
  }
  if (pi && typeof pi === "object" && "id" in pi && typeof pi.id === "string") {
    return pi.id;
  }
  return null;
}

export type PaidPaymentIntentInfo = {
  paymentIntentId: string;
  amountTotalCents: number;
  checkoutSessionId: string | null;
};

export type RetrievePaidPaymentIntentResult =
  | { ok: true; info: PaidPaymentIntentInfo }
  | { ok: false; error: string };

/** Load a PaymentIntent and ensure it succeeded (use when Stripe shows `pi_…` on the payment page). */
export async function retrievePaidPaymentIntent(
  paymentIntentIdRaw: string,
): Promise<RetrievePaidPaymentIntentResult> {
  const paymentIntentId = paymentIntentIdRaw.trim();
  if (!paymentIntentId.startsWith("pi_")) {
    return { ok: false, error: "Invalid Stripe Payment Intent id." };
  }

  const stripe = getStripeServer();
  if (!stripe) {
    return { ok: false, error: "Stripe is not configured (STRIPE_SECRET_KEY)." };
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") {
      return { ok: false, error: `Payment is not completed (status: ${pi.status ?? "unknown"}).` };
    }

    const amountTotalCents =
      typeof pi.amount_received === "number" && pi.amount_received > 0
        ? pi.amount_received
        : typeof pi.amount === "number" && Number.isFinite(pi.amount)
          ? pi.amount
          : 0;

    const checkoutSessionId =
      typeof pi.metadata?.checkout_session_id === "string" && pi.metadata.checkout_session_id.startsWith("cs_")
        ? pi.metadata.checkout_session_id
        : null;

    return {
      ok: true,
      info: { paymentIntentId, amountTotalCents, checkoutSessionId },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load Stripe Payment Intent.";
    return { ok: false, error: msg };
  }
}

/** Load a Checkout Session and ensure payment succeeded. */
export async function retrievePaidCheckoutSession(sessionIdRaw: string): Promise<RetrievePaidCheckoutResult> {
  const sessionId = sessionIdRaw.trim();
  if (!sessionId.startsWith("cs_")) {
    return { ok: false, error: "Invalid Stripe Checkout session id." };
  }

  const stripe = getStripeServer();
  if (!stripe) {
    return { ok: false, error: "Stripe is not configured (STRIPE_SECRET_KEY)." };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (session.payment_status !== "paid") {
      return { ok: false, error: `Checkout is not paid (status: ${session.payment_status ?? "unknown"}).` };
    }

    const paymentIntentId = paymentIntentIdFromSession(session);
    if (!paymentIntentId) {
      return { ok: false, error: "No payment intent found on this Checkout session." };
    }

    const amountTotalCents =
      typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
        ? session.amount_total
        : 0;

    return {
      ok: true,
      info: { sessionId, paymentIntentId, amountTotalCents },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load Stripe Checkout session.";
    return { ok: false, error: msg };
  }
}

export type CreateStripeRefundResult =
  | { ok: true; refundId: string; amountCents: number; status: string }
  | { ok: false; error: string };

/** Refund all or part of a PaymentIntent (returns to customer's card). */
export async function createStripeRefundForPaymentIntent(input: {
  paymentIntentId: string;
  amountCents: number;
  metadata?: Record<string, string>;
}): Promise<CreateStripeRefundResult> {
  const paymentIntentId = input.paymentIntentId.trim();
  if (!paymentIntentId.startsWith("pi_")) {
    return { ok: false, error: "Invalid payment intent id." };
  }
  const amountCents = Math.round(input.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    return { ok: false, error: "Refund amount must be at least 1 cent." };
  }

  const stripe = getStripeServer();
  if (!stripe) {
    return { ok: false, error: "Stripe is not configured (STRIPE_SECRET_KEY)." };
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents,
      reason: "requested_by_customer",
      ...(input.metadata && Object.keys(input.metadata).length > 0 ? { metadata: input.metadata } : {}),
    });
    return {
      ok: true,
      refundId: refund.id,
      amountCents: refund.amount ?? amountCents,
      status: refund.status ?? "pending",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe refund failed.";
    return { ok: false, error: msg };
  }
}

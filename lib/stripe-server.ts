import Stripe from "stripe";

let stripeSingleton: Stripe | null | undefined;

/** Shared Stripe SDK client (test or live per `STRIPE_SECRET_KEY`). */
export function getStripeServer(): Stripe | null {
  if (stripeSingleton !== undefined) {
    return stripeSingleton;
  }
  const secretRaw = process.env.STRIPE_SECRET_KEY ?? "";
  const secret = secretRaw.replace(/[\r\n\t "']/g, "").trim();
  if (!secret) {
    stripeSingleton = null;
    return null;
  }
  stripeSingleton = new Stripe(secret);
  return stripeSingleton;
}

/**
 * Stripe Checkout totals are built from per-line cent amounts; our fee engine rounds in AUD.
 * A few cents of drift is normal on multi-line carts — reject only large mismatches.
 */
export const STRIPE_CHECKOUT_AMOUNT_TOLERANCE_CENTS = 15;

/** True when the paid Checkout `amount_total` is close enough to our expected card charge. */
export function isStripeCheckoutPaidAmountAcceptable(
  expectedCardPayCents: number,
  paidAmountCents: number,
): boolean {
  if (!Number.isFinite(expectedCardPayCents) || !Number.isFinite(paidAmountCents)) {
    return false;
  }
  if (expectedCardPayCents <= 0) {
    return paidAmountCents <= 0;
  }
  return Math.abs(paidAmountCents - expectedCardPayCents) <= STRIPE_CHECKOUT_AMOUNT_TOLERANCE_CENTS;
}

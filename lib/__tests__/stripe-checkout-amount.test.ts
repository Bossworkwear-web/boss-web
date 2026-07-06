import { describe, expect, it } from "vitest";

import {
  isStripeCheckoutPaidAmountAcceptable,
  STRIPE_CHECKOUT_AMOUNT_TOLERANCE_CENTS,
} from "@/lib/stripe-checkout-amount";

describe("stripe checkout amount tolerance", () => {
  it("accepts a few cents of per-line rounding drift", () => {
    expect(isStripeCheckoutPaidAmountAcceptable(68971, 68976)).toBe(true);
    expect(isStripeCheckoutPaidAmountAcceptable(68971, 68971)).toBe(true);
    expect(isStripeCheckoutPaidAmountAcceptable(68971, 68971 + STRIPE_CHECKOUT_AMOUNT_TOLERANCE_CENTS)).toBe(
      true,
    );
  });

  it("rejects large payment mismatches", () => {
    expect(isStripeCheckoutPaidAmountAcceptable(68971, 69000)).toBe(false);
    expect(isStripeCheckoutPaidAmountAcceptable(10000, 5000)).toBe(false);
  });
});

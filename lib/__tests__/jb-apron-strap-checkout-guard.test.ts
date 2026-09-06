import { describe, expect, it } from "vitest";

import {
  cartNeedsJbApronStrapCheckoutConfirm,
  JB_APRON_STRAPLESS_CHECKOUT_CONFIRM_MESSAGE,
} from "@/lib/jb-apron-strap-checkout-guard";

describe("cartNeedsJbApronStrapCheckoutConfirm", () => {
  it("is false when cart has no apron body", () => {
    expect(
      cartNeedsJbApronStrapCheckoutConfirm([
        { productName: "JB's Wear Polo (7PIP)", productPathSlug: "jb-7pip" },
      ]),
    ).toBe(false);
  });

  it("is true when 5ACBC is present without straps", () => {
    expect(
      cartNeedsJbApronStrapCheckoutConfirm([
        {
          productName: "JB's Wear CROSS BACK CANVAS APRON (WITHOUT STRAP) (5ACBC)",
          productPathSlug: "jb-5acbc",
        },
      ]),
    ).toBe(true);
  });

  it("is true for 5ACBB and 5ACBD without straps", () => {
    expect(
      cartNeedsJbApronStrapCheckoutConfirm([{ productPathSlug: "jb-5acbb", productName: "x" }]),
    ).toBe(true);
    expect(
      cartNeedsJbApronStrapCheckoutConfirm([{ productPathSlug: "jb-5acbd", productName: "x" }]),
    ).toBe(true);
  });

  it("is false when a strap is also in the cart", () => {
    expect(
      cartNeedsJbApronStrapCheckoutConfirm([
        { productPathSlug: "jb-5acbc", productName: "Apron (5ACBC)" },
        { productPathSlug: "jb-5acbs", productName: "Strap (5ACBS)" },
      ]),
    ).toBe(false);
    expect(
      cartNeedsJbApronStrapCheckoutConfirm([
        { productPathSlug: "jb-5acbb", productName: "Apron (5ACBB)" },
        { productPathSlug: "jb-5acps", productName: "Strap (5ACPS)" },
      ]),
    ).toBe(false);
  });

  it("does not warn for 5ACBE alone (not in the checkout warn set)", () => {
    expect(
      cartNeedsJbApronStrapCheckoutConfirm([{ productPathSlug: "jb-5acbe", productName: "Apron (5ACBE)" }]),
    ).toBe(false);
  });

  it("exposes the English confirm copy", () => {
    expect(JB_APRON_STRAPLESS_CHECKOUT_CONFIRM_MESSAGE).toMatch(/without straps/i);
    expect(JB_APRON_STRAPLESS_CHECKOUT_CONFIRM_MESSAGE).toMatch(/5ACBS/);
    expect(JB_APRON_STRAPLESS_CHECKOUT_CONFIRM_MESSAGE).toMatch(/5ACPS/);
  });
});

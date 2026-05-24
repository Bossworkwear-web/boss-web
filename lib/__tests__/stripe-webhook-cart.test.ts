import { describe, expect, it } from "vitest";

import { cartItemToStoreOrderLine, cartItemsToStoreOrderLines } from "@/lib/cart-to-store-order-line";
import type { CartItem } from "@/lib/cart";
import {
  isStripeCheckoutCompletedEvent,
  shouldFulfillStripeCheckoutSession,
  STRIPE_WEBHOOK_CHECKOUT_COMPLETED,
} from "@/lib/stripe-webhook-handlers";

const sampleCartItem: CartItem = {
  id: "line-1",
  productId: "prod-abc",
  supplierName: "Supplier Co",
  productPathSlug: "polo-shirt",
  imageUrl: "https://example.com/img.jpg",
  productName: "Polo Shirt",
  category: "Apparel",
  serviceType: "Embroidery",
  color: "Navy",
  size: "L",
  quantity: 2,
  placements: ["Left chest"],
  listUnitPrice: 45,
  unitPrice: 42,
  totalPrice: 84,
  addedAt: "2026-05-19T00:00:00.000Z",
  notes: "Company logo",
  referenceImageUrls: ["https://example.com/logo.png"],
  specialDealPackageId: "deal-1",
};

describe("cartItemToStoreOrderLine", () => {
  it("maps cart fields to store order payload without cart-only keys", () => {
    const line = cartItemToStoreOrderLine(sampleCartItem);
    expect(line).toEqual({
      productId: "prod-abc",
      supplierName: "Supplier Co",
      productName: "Polo Shirt",
      category: "Apparel",
      serviceType: "Embroidery",
      color: "Navy",
      size: "L",
      quantity: 2,
      placements: ["Left chest"],
      listUnitPrice: 45,
      unitPrice: 42,
      totalPrice: 84,
      notes: "Company logo",
      referenceImageUrls: ["https://example.com/logo.png"],
      imageUrl: "https://example.com/img.jpg",
      productPathSlug: "polo-shirt",
      specialDealPackageId: "deal-1",
    });
    expect(line).not.toHaveProperty("id");
    expect(line).not.toHaveProperty("addedAt");
  });

  it("defaults missing optional arrays and strings", () => {
    const minimal: CartItem = {
      ...sampleCartItem,
      serviceType: undefined as unknown as string,
      color: undefined as unknown as string,
      size: undefined as unknown as string,
      placements: undefined as unknown as string[],
    };
    const line = cartItemToStoreOrderLine(minimal);
    expect(line.serviceType).toBe("");
    expect(line.color).toBe("");
    expect(line.size).toBe("");
    expect(line.placements).toEqual([]);
  });

  it("maps multiple lines", () => {
    expect(cartItemsToStoreOrderLines([sampleCartItem, sampleCartItem])).toHaveLength(2);
  });
});

describe("stripe webhook handlers", () => {
  it("detects checkout.session.completed", () => {
    expect(isStripeCheckoutCompletedEvent({ type: STRIPE_WEBHOOK_CHECKOUT_COMPLETED })).toBe(true);
    expect(isStripeCheckoutCompletedEvent({ type: "payment_intent.succeeded" })).toBe(false);
  });

  it("fulfills only paid checkout sessions with cs_ id", () => {
    expect(shouldFulfillStripeCheckoutSession({ payment_status: "paid", id: "cs_test_123" })).toBe(true);
    expect(shouldFulfillStripeCheckoutSession({ payment_status: "unpaid", id: "cs_test_123" })).toBe(false);
    expect(shouldFulfillStripeCheckoutSession({ payment_status: "paid", id: "pi_test_123" })).toBe(false);
    expect(shouldFulfillStripeCheckoutSession({ payment_status: "paid", id: null })).toBe(false);
  });
});

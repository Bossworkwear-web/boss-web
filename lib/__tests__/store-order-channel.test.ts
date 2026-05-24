import { describe, expect, it } from "vitest";

import {
  isInstoreStoreOrder,
  isOnlineStoreOrder,
  storeOrderDetailBackHref,
  storeOrdersListBasePath,
} from "@/lib/store-order-channel";

describe("store-order-channel", () => {
  describe("isOnlineStoreOrder", () => {
    it("returns true when stripe checkout session id is set", () => {
      expect(isOnlineStoreOrder({ stripe_checkout_session_id: "cs_test_123" })).toBe(true);
    });

    it("returns true when stripe payment intent id is set", () => {
      expect(isOnlineStoreOrder({ stripe_payment_intent_id: "pi_test_456" })).toBe(true);
    });

    it("returns false when stripe fields are empty or missing", () => {
      expect(isOnlineStoreOrder({})).toBe(false);
      expect(
        isOnlineStoreOrder({
          stripe_checkout_session_id: "",
          stripe_payment_intent_id: "   ",
        }),
      ).toBe(false);
    });
  });

  describe("isInstoreStoreOrder", () => {
    it("is the inverse of isOnlineStoreOrder", () => {
      expect(isInstoreStoreOrder({ stripe_checkout_session_id: "cs_1" })).toBe(false);
      expect(isInstoreStoreOrder({})).toBe(true);
    });
  });

  describe("storeOrdersListBasePath", () => {
    it("maps channels to admin list routes", () => {
      expect(storeOrdersListBasePath("online")).toBe("/admin/online-orders");
      expect(storeOrdersListBasePath("instore")).toBe("/admin/instore-orders");
    });
  });

  describe("storeOrderDetailBackHref", () => {
    it("returns online orders path for stripe-paid orders", () => {
      expect(storeOrderDetailBackHref({ stripe_checkout_session_id: "cs_abc" })).toBe(
        "/admin/online-orders",
      );
    });

    it("returns instore orders path for admin-created orders", () => {
      expect(storeOrderDetailBackHref({})).toBe("/admin/instore-orders");
    });
  });
});

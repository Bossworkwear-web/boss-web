import { describe, expect, it } from "vitest";

import {
  STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD,
  cartHasEmbroideryLogoReferenceUploads,
  cartHasEmbroideryService,
  computeStorefrontCheckoutFees,
  logoSetupFeeInclGstAud,
} from "@/lib/storefront-cart-checkout-fees";

const embroideryItem = { serviceType: "Embroidery" };
const plainItem = { serviceType: "Plain" };

describe("storefront-cart-checkout-fees", () => {
  describe("logoSetupFeeInclGstAud", () => {
    it("charges $60 + 10% GST", () => {
      expect(logoSetupFeeInclGstAud()).toBe(66);
    });
  });

  describe("cartHasEmbroideryService", () => {
    it("detects embroidery lines case-insensitively", () => {
      expect(cartHasEmbroideryService([plainItem])).toBe(false);
      expect(cartHasEmbroideryService([{ serviceType: "EMBROIDERY left chest" }])).toBe(true);
    });
  });

  describe("cartHasEmbroideryLogoReferenceUploads", () => {
    it("requires embroidery plus a non-empty reference URL", () => {
      expect(
        cartHasEmbroideryLogoReferenceUploads([
          { serviceType: "Embroidery", referenceImageUrls: ["https://example.com/logo.png"] },
        ]),
      ).toBe(true);
      expect(
        cartHasEmbroideryLogoReferenceUploads([
          { serviceType: "Embroidery", referenceImageUrls: ["  "] },
        ]),
      ).toBe(false);
      expect(
        cartHasEmbroideryLogoReferenceUploads([
          { serviceType: "Plain", referenceImageUrls: ["https://example.com/logo.png"] },
        ]),
      ).toBe(false);
    });
  });

  describe("computeStorefrontCheckoutFees", () => {
    const signedInBase = {
      subtotalAud: 100,
      items: [embroideryItem],
      deliveryPostcode: "6062",
      estimatedWeightKg: 5,
      isCustomerSignedIn: true,
      hasPriorEmbroideryOrder: false as boolean | null,
    };

    it("shows no delivery or logo fees for guests", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        isCustomerSignedIn: false,
      });
      expect(result.deliveryFeeAud).toBe(0);
      expect(result.logoSetupFeeAud).toBe(0);
      expect(result.logoSetupApplies).toBe(false);
      expect(result.totalAud).toBe(100);
    });

    it("waives delivery when customer chooses warehouse pick-up", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        deliveryPostcode: "6000",
        pickUp: true,
      });
      expect(result.deliveryFeeAud).toBe(0);
    });

    it("adds logo setup for first embroidery order under promo threshold", () => {
      const subtotal = STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD - 1;
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: subtotal,
        hasPriorEmbroideryOrder: false,
      });
      expect(result.logoSetupFeeAud).toBe(66);
      expect(result.logoSetupApplies).toBe(true);
      expect(result.totalAud).toBe(subtotal + 66);
    });

    it("waives logo setup at or above the promo subtotal threshold", () => {
      const subtotal = STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD;
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: subtotal,
        hasPriorEmbroideryOrder: false,
      });
      expect(result.logoSetupFeeAud).toBe(0);
      expect(result.logoSetupApplies).toBe(false);
      expect(result.totalAud).toBe(subtotal);
    });

    it("charges logo setup when returning customer uploads new artwork under promo threshold", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD - 1,
        hasPriorEmbroideryOrder: true,
        items: [
          {
            serviceType: "Embroidery",
            referenceImageUrls: ["https://cdn.example/logo.png"],
          },
        ],
      });
      expect(result.logoSetupFeeAud).toBe(66);
      expect(result.logoSetupApplies).toBe(true);
    });

    it("waives logo setup for returning customer new artwork when promo subtotal is met", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD,
        hasPriorEmbroideryOrder: true,
        items: [
          {
            serviceType: "Embroidery",
            referenceImageUrls: ["https://cdn.example/logo.png"],
          },
        ],
      });
      expect(result.logoSetupFeeAud).toBe(0);
      expect(result.logoSetupApplies).toBe(false);
    });

    it("skips logo setup while prior-order history is still loading", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        hasPriorEmbroideryOrder: null,
      });
      expect(result.logoSetupFeeAud).toBe(0);
      expect(result.logoSetupApplies).toBe(false);
    });

    it("skips logo setup for special-deal package carts", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        hasPriorEmbroideryOrder: false,
        items: [{ serviceType: "Embroidery", specialDealPackageId: "c81-five-pack" }],
      });
      expect(result.logoSetupFeeAud).toBe(0);
      expect(result.logoSetupApplies).toBe(false);
    });

    it("adds delivery fee for signed-in customers with a distant postcode", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        items: [plainItem],
        deliveryPostcode: "6000",
        estimatedWeightKg: 5,
        hasPriorEmbroideryOrder: true,
      });
      expect(result.deliveryFeeAud).toBeGreaterThan(0);
      expect(result.totalAud).toBe(100 + result.deliveryFeeAud);
    });
  });
});

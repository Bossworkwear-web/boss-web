import { describe, expect, it } from "vitest";

import { LOCAL_MINIMUM_DELIVERY_FEE_AUD } from "@/lib/customer-delivery-estimate";
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
    /** Warehouse suburb (6062) now pays the local minimum band, not $0. */
    const localDelivery = LOCAL_MINIMUM_DELIVERY_FEE_AUD;

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

    it("charges local minimum delivery for the warehouse postcode (not free)", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        items: [plainItem],
        deliveryPostcode: "6062",
        estimatedWeightKg: 2,
        hasPriorEmbroideryOrder: true,
      });
      expect(result.deliveryFeeAud).toBe(localDelivery);
      expect(result.totalAud).toBe(100 + localDelivery);
    });

    it("adds 50% delivery surcharge for interstate (non-WA) postcodes", () => {
      const wa = computeStorefrontCheckoutFees({
        ...signedInBase,
        items: [plainItem],
        deliveryPostcode: "6065",
        estimatedWeightKg: 5,
        hasPriorEmbroideryOrder: true,
      });
      const nsw = computeStorefrontCheckoutFees({
        ...signedInBase,
        items: [plainItem],
        deliveryPostcode: "2000",
        estimatedWeightKg: 5,
        hasPriorEmbroideryOrder: true,
      });
      // NSW is far enough to hit the top band ($48), then ×1.5 → $72.
      expect(nsw.deliveryFeeAud).toBe(72);
      expect(nsw.deliveryFeeAud).toBeGreaterThan(wa.deliveryFeeAud);
    });

    it("adds logo setup for first embroidery order under promo threshold", () => {
      const subtotal = STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD - 1;
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: subtotal,
        hasPriorEmbroideryOrder: false,
        items: [{ serviceType: "Embroidery", embroideryLogoSetup: "new" }],
      });
      expect(result.logoSetupFeeAud).toBe(66);
      expect(result.logoSetupApplies).toBe(true);
      expect(result.deliveryFeeAud).toBe(localDelivery);
      expect(result.totalAud).toBe(subtotal + 66 + localDelivery);
    });

    it("waives logo setup when customer chose saved embroidery logo", () => {
      const subtotal = STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD - 1;
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: subtotal,
        hasPriorEmbroideryOrder: false,
        items: [{ serviceType: "Embroidery", embroideryLogoSetup: "saved" }],
      });
      expect(result.logoSetupFeeAud).toBe(0);
      expect(result.logoSetupApplies).toBe(false);
      expect(result.totalAud).toBe(subtotal + localDelivery);
    });

    it("defaults to charging logo setup when embroideryLogoSetup is omitted (must not strip at Stripe checkout)", () => {
      const subtotal = STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD - 1;
      const strippedLikeOldStripeCheckout = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: subtotal,
        hasPriorEmbroideryOrder: false,
        items: [{ serviceType: "Embroidery" }],
      });
      expect(strippedLikeOldStripeCheckout.logoSetupFeeAud).toBe(66);

      const withSavedChoice = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: subtotal,
        hasPriorEmbroideryOrder: false,
        items: [{ serviceType: "Embroidery", embroideryLogoSetup: "saved" }],
      });
      expect(withSavedChoice.logoSetupFeeAud).toBe(0);
    });

    it("waives logo setup for legacy cart notes that selected saved embroidery logo", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: 100,
        hasPriorEmbroideryOrder: false,
        items: [
          {
            serviceType: "Embroidery",
            notes: "\n\n[Embroidery logo setup: Use my saved embroidery logo ($0)]",
          },
        ],
      });
      expect(result.logoSetupFeeAud).toBe(0);
      expect(result.logoSetupApplies).toBe(false);
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
      expect(result.totalAud).toBe(subtotal + localDelivery);
    });

    it("charges logo setup when returning customer uploads new artwork under promo threshold", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD - 1,
        hasPriorEmbroideryOrder: true,
        items: [
          {
            serviceType: "Embroidery",
            embroideryLogoSetup: "new",
            referenceImageUrls: ["https://cdn.example/logo.png"],
          },
        ],
      });
      expect(result.logoSetupFeeAud).toBe(66);
      expect(result.logoSetupApplies).toBe(true);
    });

    it("waives logo setup when returning customer chose saved logo even with reference URLs", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD - 1,
        hasPriorEmbroideryOrder: true,
        items: [
          {
            serviceType: "Embroidery",
            embroideryLogoSetup: "saved",
            referenceImageUrls: ["https://cdn.example/logo.png"],
          },
        ],
      });
      expect(result.logoSetupFeeAud).toBe(0);
      expect(result.logoSetupApplies).toBe(false);
    });

    it("waives logo setup for returning customer new artwork when promo subtotal is met", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        subtotalAud: STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD,
        hasPriorEmbroideryOrder: true,
        items: [
          {
            serviceType: "Embroidery",
            embroideryLogoSetup: "new",
            referenceImageUrls: ["https://cdn.example/logo.png"],
          },
        ],
      });
      expect(result.logoSetupFeeAud).toBe(0);
      expect(result.logoSetupApplies).toBe(false);
    });

    it("charges logo setup immediately without waiting for prior-order history", () => {
      const result = computeStorefrontCheckoutFees({
        ...signedInBase,
        hasPriorEmbroideryOrder: null,
        items: [{ serviceType: "Embroidery", embroideryLogoSetup: "new" }],
      });
      expect(result.logoSetupFeeAud).toBe(66);
      expect(result.logoSetupApplies).toBe(true);
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

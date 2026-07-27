import {
  calculateDeliveryFee,
  distanceKmFromCompanyBase,
} from "@/lib/customer-delivery-estimate";
import { STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";
import { cartHasSpecialDealPackage } from "@/lib/storefront-special-deal-package-cart";

/** Product subtotal (excl. delivery & logo setup) must be at or above this for logo-setup waiver promo. */
export const STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD = 600;

/** Cart → payment → Stripe return: customer chose warehouse pick-up (no delivery fee). */
export const CHECKOUT_PICK_UP_SESSION_KEY = "boss_web_checkout_pick_up_v1";

export const STOREFRONT_LOGO_SETUP_BEFORE_GST_AUD = 60;

function roundAudMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** One-off logo setup: $60 + GST (10%). */
export function logoSetupFeeInclGstAud(): number {
  return roundAudMoney(STOREFRONT_LOGO_SETUP_BEFORE_GST_AUD * (1 + STOREFRONT_RETAIL_GST_RATE));
}

export function cartHasEmbroideryService(items: { serviceType: string }[]): boolean {
  return items.some((it) => (it.serviceType ?? "").toLowerCase().includes("embroidery"));
}

export type EmbroideryLogoSetupChoice = "new" | "saved";

const EMBROIDERY_LOGO_SETUP_NOTE_BLOCK_RE = /\n\n\[Embroidery logo setup:[^\]]*\]/gi;
const EMBROIDERY_LOGO_SETUP_SAVED_NOTE_RE = /\[Embroidery logo setup:\s*Use my saved embroidery logo/i;

/** Remove the auto-appended embroidery setup note from cart line notes (PDP edit UX). */
export function stripEmbroideryLogoSetupNote(notes: string): string {
  return String(notes ?? "")
    .replace(EMBROIDERY_LOGO_SETUP_NOTE_BLOCK_RE, "")
    .trim();
}

type EmbroideryLogoSetupLine = {
  serviceType: string;
  notes?: string;
  embroideryLogoSetup?: EmbroideryLogoSetupChoice;
};

/** Resolve PDP / cart embroidery logo setup choice (field preferred; legacy notes fallback). */
export function resolveEmbroideryLogoSetup(line: EmbroideryLogoSetupLine): EmbroideryLogoSetupChoice {
  if (line.embroideryLogoSetup === "saved" || line.embroideryLogoSetup === "new") {
    return line.embroideryLogoSetup;
  }
  if (EMBROIDERY_LOGO_SETUP_SAVED_NOTE_RE.test(String(line.notes ?? ""))) {
    return "saved";
  }
  return "new";
}

/** True when at least one embroidery line needs the one-off logo setup fee. */
export function cartRequiresEmbroideryLogoSetupFee(
  items: { serviceType: string; notes?: string; embroideryLogoSetup?: EmbroideryLogoSetupChoice }[],
): boolean {
  return items.some((it) => {
    if (!(it.serviceType ?? "").toLowerCase().includes("embroidery")) {
      return false;
    }
    return resolveEmbroideryLogoSetup(it) === "new";
  });
}

/** True when an embroidery line includes at least one customer-supplied reference/logo URL (new artwork). */
export function cartHasEmbroideryLogoReferenceUploads(
  items: { serviceType: string; referenceImageUrls?: string[] }[],
): boolean {
  return items.some((it) => {
    const emb = (it.serviceType ?? "").toLowerCase().includes("embroidery");
    const urls = it.referenceImageUrls;
    if (!emb || !Array.isArray(urls)) return false;
    return urls.some((u) => typeof u === "string" && u.trim().length > 0);
  });
}

export type StorefrontCheckoutFeesInput = {
  subtotalAud: number;
  items: {
    serviceType: string;
    notes?: string;
    embroideryLogoSetup?: EmbroideryLogoSetupChoice;
    referenceImageUrls?: string[];
    specialDealPackageId?: string;
  }[];
  deliveryPostcode: string | null;
  estimatedWeightKg: number;
  /** Guest cart: delivery & logo setup shown as $0 until signed in. */
  isCustomerSignedIn: boolean;
  /**
   * `null` = history not loaded yet — logo setup is not added to totals (cart UI).
   * Server paths should always pass a boolean.
   */
  hasPriorEmbroideryOrder: boolean | null;
  /** Warehouse pick-up — delivery fee is $0 (signed-in customers only). */
  pickUp?: boolean;
};

export type StorefrontCheckoutFeesResult = {
  deliveryFeeAud: number;
  logoSetupFeeAud: number;
  logoSetupApplies: boolean;
  totalAud: number;
};

export function computeStorefrontCheckoutFees(input: StorefrontCheckoutFeesInput): StorefrontCheckoutFeesResult {
  const {
    subtotalAud,
    items,
    deliveryPostcode,
    estimatedWeightKg,
    isCustomerSignedIn,
    pickUp = false,
  } = input;

  const distanceKm = distanceKmFromCompanyBase(deliveryPostcode);
  const baseDelivery = calculateDeliveryFee(distanceKm, estimatedWeightKg, deliveryPostcode);

  let deliveryFeeAud = 0;

  if (!isCustomerSignedIn || pickUp) {
    deliveryFeeAud = 0;
  } else {
    deliveryFeeAud = baseDelivery;
  }

  const hasEmb = cartHasEmbroideryService(items);
  const promoSubtotalHit = subtotalAud >= STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD;
  const needsLogoSetupFee = cartRequiresEmbroideryLogoSetupFee(items);
  let logoSetupFeeAud = 0;
  let logoSetupApplies = false;

  const logoIncludedInPackageDeal = cartHasSpecialDealPackage(items);

  if (isCustomerSignedIn && hasEmb && !logoIncludedInPackageDeal) {
    /** Promo override: at/above subtotal threshold, logo setup is always waived. */
    if (!promoSubtotalHit && needsLogoSetupFee) {
      logoSetupFeeAud = logoSetupFeeInclGstAud();
      logoSetupApplies = true;
    }
  }

  const totalAud = roundAudMoney(subtotalAud + deliveryFeeAud + logoSetupFeeAud);

  return {
    deliveryFeeAud,
    logoSetupFeeAud,
    logoSetupApplies,
    totalAud,
  };
}

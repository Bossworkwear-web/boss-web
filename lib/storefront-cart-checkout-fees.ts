import {
  calculateDeliveryFee,
  distanceKmFromCompanyBase,
} from "@/lib/customer-delivery-estimate";
import { STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";

/** Product subtotal (excl. delivery & logo setup) must be at or above this for promos. */
export const STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD = 400;

export const STOREFRONT_LOGO_SETUP_BEFORE_GST_AUD = 60;

function roundAudMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** One-off logo setup: $60 + GST (10%). */
export function logoSetupFeeInclGstAud(): number {
  return roundAudMoney(STOREFRONT_LOGO_SETUP_BEFORE_GST_AUD * (1 + STOREFRONT_RETAIL_GST_RATE));
}

/**
 * Perth metro delivery postcodes (WA 6000–6199): free delivery when cart subtotal ≥ minimum.
 */
export function isPerthMetroDeliveryPostcode(postcode: string | null): boolean {
  if (postcode == null || postcode.length !== 4) {
    return false;
  }
  const n = Number.parseInt(postcode, 10);
  if (!Number.isFinite(n)) {
    return false;
  }
  return n >= 6000 && n <= 6199;
}

export function cartHasEmbroideryService(items: { serviceType: string }[]): boolean {
  return items.some((it) => (it.serviceType ?? "").toLowerCase().includes("embroidery"));
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
  items: { serviceType: string; referenceImageUrls?: string[] }[];
  deliveryPostcode: string | null;
  estimatedWeightKg: number;
  /** Guest cart: delivery & logo setup shown as $0 until signed in. */
  isCustomerSignedIn: boolean;
  /**
   * `null` = history not loaded yet — logo setup is not added to totals (cart UI).
   * Server paths should always pass a boolean.
   */
  hasPriorEmbroideryOrder: boolean | null;
};

export type StorefrontCheckoutFeesResult = {
  deliveryFeeAud: number;
  logoSetupFeeAud: number;
  logoSetupApplies: boolean;
  perthMetroDeliveryFree: boolean;
  totalAud: number;
};

export function computeStorefrontCheckoutFees(input: StorefrontCheckoutFeesInput): StorefrontCheckoutFeesResult {
  const { subtotalAud, items, deliveryPostcode, estimatedWeightKg, isCustomerSignedIn, hasPriorEmbroideryOrder } =
    input;

  const distanceKm = distanceKmFromCompanyBase(deliveryPostcode);
  const baseDelivery = calculateDeliveryFee(distanceKm, estimatedWeightKg);

  let perthMetroDeliveryFree = false;
  let deliveryFeeAud = 0;

  if (!isCustomerSignedIn) {
    deliveryFeeAud = 0;
  } else if (
    subtotalAud >= STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD &&
    isPerthMetroDeliveryPostcode(deliveryPostcode)
  ) {
    deliveryFeeAud = 0;
    perthMetroDeliveryFree = true;
  } else {
    deliveryFeeAud = baseDelivery;
  }

  const hasEmb = cartHasEmbroideryService(items);
  const historyKnown = hasPriorEmbroideryOrder !== null;
  const hasNewLogoFilesOnEmbroidery = cartHasEmbroideryLogoReferenceUploads(items);
  const promoSubtotalHit = subtotalAud >= STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD;
  const firstEmbroideryLogoSetupUnderPromo =
    hasPriorEmbroideryOrder === false && !promoSubtotalHit;
  /** Returning customers: new logo files on an embroidery line still need digitising/setup. */
  const returningCustomerNewLogoSetup =
    hasPriorEmbroideryOrder === true && hasNewLogoFilesOnEmbroidery;
  let logoSetupFeeAud = 0;
  let logoSetupApplies = false;

  if (isCustomerSignedIn && historyKnown && hasEmb) {
    /** Promo override: at/above subtotal threshold, logo setup is always waived. */
    if (!promoSubtotalHit && (firstEmbroideryLogoSetupUnderPromo || returningCustomerNewLogoSetup)) {
      logoSetupFeeAud = logoSetupFeeInclGstAud();
      logoSetupApplies = true;
    }
  }

  const totalAud = roundAudMoney(subtotalAud + deliveryFeeAud + logoSetupFeeAud);

  return {
    deliveryFeeAud,
    logoSetupFeeAud,
    logoSetupApplies,
    perthMetroDeliveryFree,
    totalAud,
  };
}

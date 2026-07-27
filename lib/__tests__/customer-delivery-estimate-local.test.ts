import { describe, expect, it } from "vitest";

import {
  COMPANY_BASE_POSTCODE,
  INTERSTATE_DELIVERY_FEE_MULTIPLIER,
  LOCAL_MINIMUM_DELIVERY_FEE_AUD,
  LOCAL_SAME_POSTCODE_DISTANCE_KM,
  calculateDeliveryFee,
  distanceKmFromCompanyBase,
  isWesternAustraliaPostcode,
} from "@/lib/customer-delivery-estimate";

describe("customer-delivery-estimate local delivery", () => {
  it("treats the warehouse postcode as a short local trip, not zero km", () => {
    expect(distanceKmFromCompanyBase(COMPANY_BASE_POSTCODE)).toBe(LOCAL_SAME_POSTCODE_DISTANCE_KM);
    expect(calculateDeliveryFee(LOCAL_SAME_POSTCODE_DISTANCE_KM, 2)).toBe(LOCAL_MINIMUM_DELIVERY_FEE_AUD);
  });

  it("still returns no fee when postcode is missing", () => {
    expect(distanceKmFromCompanyBase(null)).toBe(0);
    expect(distanceKmFromCompanyBase("")).toBe(0);
    expect(calculateDeliveryFee(0, 2)).toBe(0);
  });

  it("charges at least the local minimum for nearby metro postcodes", () => {
    const km = distanceKmFromCompanyBase("6065");
    expect(km).toBeGreaterThan(0);
    expect(calculateDeliveryFee(km, 3, "6065")).toBeGreaterThanOrEqual(LOCAL_MINIMUM_DELIVERY_FEE_AUD);
  });

  it("does not surcharge Western Australia postcodes", () => {
    expect(isWesternAustraliaPostcode("6000")).toBe(true);
    expect(isWesternAustraliaPostcode("6797")).toBe(true);
    const km = distanceKmFromCompanyBase("6065");
    expect(calculateDeliveryFee(km, 3, "6065")).toBe(calculateDeliveryFee(km, 3));
  });

  it("adds 50% for interstate (non-WA) postcodes", () => {
    expect(isWesternAustraliaPostcode("2000")).toBe(false);
    const km = distanceKmFromCompanyBase("2000");
    expect(km).toBeGreaterThan(200);
    const waEquivalent = calculateDeliveryFee(km, 5);
    expect(calculateDeliveryFee(km, 5, "2000")).toBe(
      Math.round(waEquivalent * INTERSTATE_DELIVERY_FEE_MULTIPLIER * 100) / 100,
    );
  });
});

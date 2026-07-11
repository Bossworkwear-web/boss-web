import { describe, expect, it } from "vitest";

import {
  COMPANY_BASE_POSTCODE,
  LOCAL_MINIMUM_DELIVERY_FEE_AUD,
  LOCAL_SAME_POSTCODE_DISTANCE_KM,
  calculateDeliveryFee,
  distanceKmFromCompanyBase,
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
    expect(calculateDeliveryFee(km, 3)).toBeGreaterThanOrEqual(LOCAL_MINIMUM_DELIVERY_FEE_AUD);
  });
});

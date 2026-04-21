/**
 * Rough delivery distance from the warehouse postcode (6062, WA) to the customer's
 * delivery address postcode. Uses straight-line km between representative coordinates
 * (region buckets for WA; state capitals / hubs elsewhere). Replace with a postcode
 * table or carrier API when you need street-level accuracy.
 */

export const COMPANY_BASE_POSTCODE = "6062";

/** Approximate centroid for postcode 6062 (Morley / Balcatta / Dianella area, WA). */
const COMPANY_BASE_COORDS = { lat: -31.872, lng: 115.836 };

const R_EARTH_KM = 6371;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Representative coords for WA postcodes (bucketed). Unknown WA codes fall back to Perth metro.
 */
function coordsForWaPostcode(n: number): { lat: number; lng: number } {
  if (n >= 6000 && n <= 6029) {
    return { lat: -31.82, lng: 115.77 };
  }
  if (n >= 6030 && n <= 6059) {
    return { lat: -31.78, lng: 115.805 };
  }
  if (n >= 6060 && n <= 6099) {
    return { lat: -31.87, lng: 115.84 };
  }
  if (n >= 6100 && n <= 6139) {
    return { lat: -32.05, lng: 115.92 };
  }
  if (n >= 6140 && n <= 6169) {
    return { lat: -32.22, lng: 115.78 };
  }
  if (n >= 6170 && n <= 6199) {
    return { lat: -32.55, lng: 115.75 };
  }
  if (n >= 6200 && n <= 6299) {
    return { lat: -33.33, lng: 115.65 };
  }
  if (n >= 6300 && n <= 6499) {
    return { lat: -34.95, lng: 117.94 };
  }
  if (n >= 6500 && n <= 6699) {
    return { lat: -28.78, lng: 114.61 };
  }
  if (n >= 6700 && n <= 6797) {
    return { lat: -17.96, lng: 122.23 };
  }
  return { lat: -31.95, lng: 115.86 };
}

function coordsForAustralianPostcode(postcode: string): { lat: number; lng: number } | null {
  const n = Number.parseInt(postcode, 10);
  if (!Number.isFinite(n) || postcode.length !== 4) {
    return null;
  }
  // WA
  if (n >= 6000 && n <= 6797) {
    return coordsForWaPostcode(n);
  }
  // NSW / ACT (simplified)
  if ((n >= 1000 && n <= 1999) || (n >= 2000 && n <= 2599) || (n >= 2619 && n <= 2898)) {
    return { lat: -33.8688, lng: 151.2093 };
  }
  if (n >= 2600 && n <= 2618) {
    return { lat: -35.2809, lng: 149.13 };
  }
  if (n >= 2900 && n <= 2920) {
    return { lat: -35.2809, lng: 149.13 };
  }
  // VIC
  if ((n >= 3000 && n <= 3999) || (n >= 8000 && n <= 8999)) {
    return { lat: -37.8136, lng: 144.9631 };
  }
  // QLD
  if ((n >= 4000 && n <= 4999) || (n >= 9000 && n <= 9999)) {
    return { lat: -27.4698, lng: 153.0251 };
  }
  // SA
  if (n >= 5000 && n <= 5999) {
    return { lat: -34.9285, lng: 138.6007 };
  }
  // TAS
  if (n >= 7000 && n <= 7999) {
    return { lat: -42.8821, lng: 147.3272 };
  }
  // NT
  if (n >= 800 && n <= 999) {
    return { lat: -12.4634, lng: 130.8456 };
  }
  return null;
}

/**
 * Prefer the last 4-digit group (Australian addresses usually end with "STATE 6027").
 */
export function extractAustralianPostcodeFromAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) {
    return null;
  }
  const matches = trimmed.match(/\b(\d{4})\b/g);
  if (!matches?.length) {
    return null;
  }
  const last = matches[matches.length - 1];
  return /^\d{4}$/.test(last) ? last : null;
}

/**
 * Straight-line km from company base (6062) to the given postcode. `null` postcode → 0 (no estimate).
 */
export function distanceKmFromCompanyBase(postcode: string | null): number {
  if (postcode == null || postcode === "") {
    return 0;
  }
  if (postcode === COMPANY_BASE_POSTCODE) {
    return 0;
  }
  const dest = coordsForAustralianPostcode(postcode);
  if (!dest) {
    return 0;
  }
  return Number(haversineKm(COMPANY_BASE_COORDS, dest).toFixed(1));
}

export type DeliveryBand = {
  maxDistanceKm: number;
  maxWeightKg: number;
  fee: number;
};

export const DELIVERY_FEE_BANDS: DeliveryBand[] = [
  { maxDistanceKm: 10, maxWeightKg: 5, fee: 8.5 },
  { maxDistanceKm: 25, maxWeightKg: 10, fee: 14.0 },
  { maxDistanceKm: 50, maxWeightKg: 20, fee: 24.0 },
  { maxDistanceKm: 200, maxWeightKg: 25, fee: 38.0 },
];

export function calculateDeliveryFee(distanceKm: number, totalWeightKg: number): number {
  if (distanceKm <= 0) {
    return 0;
  }
  const matched = DELIVERY_FEE_BANDS.find(
    (band) => distanceKm <= band.maxDistanceKm && totalWeightKg <= band.maxWeightKg,
  );
  if (matched) {
    return matched.fee;
  }
  return 48.0;
}

/** Store address passed to Google Maps search (same as Instore Service page). */
export const STORE_GOOGLE_MAPS_QUERY =
  "Shop 152, Coventry Village, 243 Walter Rd W, Morley WA 6062, Australia";

export function storeGoogleMapsSearchHref(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_GOOGLE_MAPS_QUERY)}`;
}

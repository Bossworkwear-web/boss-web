/** Store address passed to Google Maps search (same as Instore Service page). */
export const STORE_GOOGLE_MAPS_QUERY =
  "Shop 152, Coventry Village, shop 42c/253 Walter Rd W, Morley WA 6062";

export function storeGoogleMapsSearchHref(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_GOOGLE_MAPS_QUERY)}`;
}

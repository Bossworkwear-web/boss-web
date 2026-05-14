/**
 * Footer: physical address lines (edit for your storefront).
 * Social URLs: set NEXT_PUBLIC_FACEBOOK_URL and NEXT_PUBLIC_INSTAGRAM_URL for your profiles (optional).
 */
export const SITE_STORE_ADDRESS_LINES = [
  "Shop 152, COVENTRY VILLAGE, 243 Walter Rd W",
  "Perth Western Australia 6062",
] as const;

export const siteFacebookUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL ?? "https://www.facebook.com/";
export const siteInstagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/";

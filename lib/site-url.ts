/** Canonical storefront origin for metadata, sitemap, Stripe return URLs, etc. */
export function getSiteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (env) {
    return env;
  }
  const vercel = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "");
  if (vercel) {
    return `https://${vercel}`;
  }
  return "http://localhost:3000";
}

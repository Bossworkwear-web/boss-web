export function siteBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (env) {
    return env;
  }
  const vercel = process.env.VERCEL_URL?.replace(/^https?:\/\//, "");
  if (vercel) {
    return `https://${vercel}`;
  }
  return "http://localhost:3000";
}

export function australiaPostTrackingUrl(trackingNumber: string): string {
  const q = encodeURIComponent(trackingNumber.trim());
  return `https://auspost.com.au/mypost/track/#/details/${q}`;
}

export function formatMoneyFromCents(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return amount.toLocaleString("en-AU", { style: "currency", currency: currency || "AUD" });
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

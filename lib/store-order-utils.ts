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

/** Carrier-provided public tracking URL when we recognise the carrier; otherwise `null`. */
export function carrierTrackingUrl(carrier: string, trackingNumber: string | null | undefined): string | null {
  const tn = trackingNumber?.trim();
  if (!tn) {
    return null;
  }
  const c = (carrier ?? "").toLowerCase();
  if (c.includes("australia post") || c.includes("auspost")) {
    return australiaPostTrackingUrl(tn);
  }
  return null;
}

export function formatMoneyFromCents(cents: number, currency: string): string {
  const raw = Number(cents);
  const amount = Number.isFinite(raw) ? raw / 100 : 0;
  const code = (currency ?? "AUD").trim() || "AUD";
  try {
    return amount.toLocaleString("en-AU", { style: "currency", currency: code });
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

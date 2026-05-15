import { STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";

const GST_MULTIPLIER = 1 + STOREFRONT_RETAIL_GST_RATE;

/** Convert GST-inclusive cents (as stored on orders) to ex-GST dollars. */
export function audExGstFromInclGstCents(centsInclGst: number): number {
  const incl = Number(centsInclGst);
  if (!Number.isFinite(incl)) {
    return 0;
  }
  return Math.round((incl / 100 / GST_MULTIPLIER) * 100) / 100;
}

export function formatAudExGstFromInclGstCents(centsInclGst: number, currency = "AUD"): string {
  const amount = audExGstFromInclGstCents(centsInclGst);
  const code = currency.trim() || "AUD";
  try {
    return amount.toLocaleString("en-AU", { style: "currency", currency: code });
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

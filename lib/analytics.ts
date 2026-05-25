/** GA4 helpers — requires `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `GoogleAnalytics` in layout. */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function getGaMeasurementId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id || undefined;
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  if (typeof window === "undefined") return;
  if (!getGaMeasurementId() || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

/** Bulk / team quote form submitted successfully. */
export function trackQuoteRequest(params?: { quantity?: number }) {
  trackEvent("generate_lead", {
    event_category: "quote",
    lead_type: "bulk_quote",
    ...(params?.quantity != null && params.quantity > 0 ? { value: params.quantity } : {}),
  });
  trackEvent("quote_request", {
    ...(params?.quantity != null && params.quantity > 0 ? { quantity: params.quantity } : {}),
  });
}

/** Online store order completed (typically 5–20 unit retail orders). */
export function trackPurchase(params: {
  transaction_id: string;
  value?: number;
  item_count?: number;
}) {
  trackEvent("purchase", {
    currency: "AUD",
    transaction_id: params.transaction_id,
    ...(params.value != null && params.value > 0 ? { value: params.value } : {}),
    ...(params.item_count != null && params.item_count > 0 ? { item_count: params.item_count } : {}),
  });
}

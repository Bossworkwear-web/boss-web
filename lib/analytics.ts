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

/** Fire once when gtag becomes available (e.g. after a fast redirect). */
export function trackEventWhenReady(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
  maxWaitMs = 4000,
) {
  if (typeof window === "undefined" || !getGaMeasurementId()) return;

  const fire = () => trackEvent(name, params);
  if (typeof window.gtag === "function") {
    fire();
    return;
  }

  const started = Date.now();
  const timer = window.setInterval(() => {
    if (typeof window.gtag === "function") {
      window.clearInterval(timer);
      fire();
    } else if (Date.now() - started >= maxWaitMs) {
      window.clearInterval(timer);
    }
  }, 100);
}

/** Bulk / team quote form submitted successfully. */
export function trackQuoteRequest(params?: {
  quantity?: number;
  waitForGtag?: boolean;
  lead_type?: string;
}) {
  const emit = params?.waitForGtag ? trackEventWhenReady : trackEvent;
  const leadType = params?.lead_type?.trim() || "bulk_quote";
  emit("generate_lead", {
    event_category: "quote",
    lead_type: leadType,
    ...(params?.quantity != null && params.quantity > 0 ? { value: params.quantity } : {}),
  });
  emit("quote_request", {
    ...(params?.quantity != null && params.quantity > 0 ? { quantity: params.quantity } : {}),
  });
}

/** Cart → “Send email to you as a Quote” (self-service saved quote). */
export function trackCartQuoteSaved(params: {
  quote_number: string;
  value_aud?: number;
  line_count?: number;
  quantity?: number;
}) {
  const value =
    params.value_aud != null && params.value_aud > 0 ? params.value_aud : undefined;

  trackEvent("generate_lead", {
    event_category: "quote",
    lead_type: "cart_self_quote",
    currency: "AUD",
    quote_number: params.quote_number,
    ...(value != null ? { value } : {}),
    ...(params.line_count != null && params.line_count > 0
      ? { line_count: params.line_count }
      : {}),
    ...(params.quantity != null && params.quantity > 0 ? { quantity: params.quantity } : {}),
  });
  trackEvent("cart_quote_saved", {
    currency: "AUD",
    quote_number: params.quote_number,
    ...(value != null ? { value } : {}),
    ...(params.line_count != null && params.line_count > 0
      ? { line_count: params.line_count }
      : {}),
    ...(params.quantity != null && params.quantity > 0 ? { quantity: params.quantity } : {}),
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

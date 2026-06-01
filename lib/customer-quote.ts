import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";

/** Saved cart quotes are kept for this many days, then auto-expire (hidden + purged). */
export const CUSTOMER_QUOTE_RETENTION_DAYS = 30;

/** ISO timestamp for the oldest quote still visible (created on/after this point). */
export function customerQuoteRetentionCutoffIso(now = new Date()): string {
  return new Date(now.getTime() - CUSTOMER_QUOTE_RETENTION_DAYS * 86_400_000).toISOString();
}

/** Amounts (AUD cents) for a cart quote, mirroring the Cart Summary breakdown. */
export type CustomerQuoteTotals = {
  productGrossCents: number;
  volumeDiscountCents: number;
  productNetCents: number;
  logoSetupCents: number;
  deliveryCents: number;
  totalCents: number;
  totalQuantity: number;
  pickup: boolean;
};

/** Payload the cart sends to create + email a quote. */
export type CreateCustomerQuotePayload = CustomerQuoteTotals & {
  lines: StoreOrderCartLine[];
};

/** A saved quote as shown in My account → My Quote. */
export type CustomerQuoteRecord = CustomerQuoteTotals & {
  id: string;
  quoteNumber: string;
  customerEmail: string;
  customerName: string | null;
  currency: string;
  createdAt: string;
  lines: StoreOrderCartLine[];
};

export function generateCustomerQuoteNumber(now = new Date()): string {
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CQ-${ymd}-${rand}`;
}

function toCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.round(n);
}

/** Coerce/clamp client-supplied totals into safe non-negative integer cents. */
export function normalizeCustomerQuoteTotals(input: Partial<CustomerQuoteTotals>): CustomerQuoteTotals {
  return {
    productGrossCents: toCents(input.productGrossCents),
    volumeDiscountCents: toCents(input.volumeDiscountCents),
    productNetCents: toCents(input.productNetCents),
    logoSetupCents: toCents(input.logoSetupCents),
    deliveryCents: toCents(input.deliveryCents),
    totalCents: toCents(input.totalCents),
    totalQuantity: toCents(input.totalQuantity),
    pickup: Boolean(input.pickup),
  };
}

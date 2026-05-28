import { randomBytes } from "node:crypto";

import { todayPerthYmd } from "@/lib/perth-calendar";

const QUOTE_NUMBER_RE = /^QUO_\d{8}_[0-9a-f]{6,8}$/i;

export function isCustomerQuoteNumber(value: string): boolean {
  return QUOTE_NUMBER_RE.test(value.trim());
}

function perthYmdCompact(now = new Date()): string {
  return todayPerthYmd(now).replace(/-/g, "");
}

/** Stable quote number for an existing CRM `quote_requests` row. */
export function customerQuoteNumberForRequestId(quoteRequestId: string, now = new Date()): string {
  const compact = quoteRequestId.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `QUO_${perthYmdCompact(now)}_${compact}`;
}

/** New quote number before a CRM row exists (Create Quote). */
export function nextCustomerQuoteNumber(now = new Date()): string {
  return `QUO_${perthYmdCompact(now)}_${randomBytes(3).toString("hex")}`;
}

export function ensureCustomerQuoteNumber(
  existing: string,
  options?: { quoteRequestId?: string | null },
): string {
  const trimmed = existing.trim();
  if (trimmed) {
    return trimmed;
  }

  const quoteRequestId = options?.quoteRequestId?.trim();
  if (quoteRequestId && /^[0-9a-f-]{36}$/i.test(quoteRequestId)) {
    return customerQuoteNumberForRequestId(quoteRequestId);
  }

  return nextCustomerQuoteNumber();
}

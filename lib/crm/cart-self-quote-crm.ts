import { CART_SELF_QUOTE_LEAD_SOURCE } from "@/lib/crm/lead-sources";

export { CART_SELF_QUOTE_LEAD_SOURCE };

type CartSelfQuoteCrmRow = {
  lead_source: string;
  pipeline_stage: string;
  notes: string | null;
  website_quote_submission?: unknown | null;
};

export type CartSelfQuoteSubmission = {
  type?: string;
  customer_quote_id?: string;
  quote_number?: string;
  total_cents?: number;
  line_count?: number;
  total_quantity?: number;
  pickup?: boolean;
};

export function isCartSelfQuoteLead(quote: { lead_source: string }): boolean {
  return quote.lead_source === CART_SELF_QUOTE_LEAD_SOURCE;
}

export function parseCartSelfQuoteSubmission(raw: unknown): CartSelfQuoteSubmission | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const row = raw as CartSelfQuoteSubmission;
  if (row.type !== "cart_self_quote") {
    return null;
  }
  return row;
}

export function cartSelfQuoteNumberFromRow(quote: CartSelfQuoteCrmRow): string | null {
  const fromJson = parseCartSelfQuoteSubmission(quote.website_quote_submission)?.quote_number;
  if (typeof fromJson === "string" && fromJson.trim()) {
    return fromJson.trim();
  }
  const notes = quote.notes ?? "";
  const match = notes.match(/CQ-\d{8}-\d{4}/);
  return match?.[0] ?? null;
}

export function cartSelfQuoteTotalCentsFromRow(quote: CartSelfQuoteCrmRow): number | null {
  const cents = parseCartSelfQuoteSubmission(quote.website_quote_submission)?.total_cents;
  return typeof cents === "number" && Number.isFinite(cents) && cents >= 0 ? cents : null;
}

/** Self-quote mini-pipeline columns (maps existing pipeline_stage values). */
export type CartSelfQuotePipelineColumn = "emailed" | "in_progress" | "ordered";

export function cartSelfQuotePipelineColumn(quote: CartSelfQuoteCrmRow): CartSelfQuotePipelineColumn {
  if (quote.pipeline_stage === "completion") {
    return "ordered";
  }
  if (quote.pipeline_stage === "quote" || quote.pipeline_stage === "approval") {
    return "in_progress";
  }
  return "emailed";
}

export const CART_SELF_QUOTE_COLUMN_LABELS: Record<CartSelfQuotePipelineColumn, string> = {
  emailed: "Self quote emailed",
  in_progress: "Staff follow-up",
  ordered: "Ordered",
};

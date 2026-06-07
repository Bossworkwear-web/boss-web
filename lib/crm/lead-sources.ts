export const WEBSITE_QUOTE_LEAD_SOURCE = "website" as const;
export const BULK_ENQUIRY_LEAD_SOURCE = "bulk_enquiry" as const;
export const CART_SELF_QUOTE_LEAD_SOURCE = "cart_self_quote" as const;

export type QuoteLeadSource =
  | typeof WEBSITE_QUOTE_LEAD_SOURCE
  | typeof BULK_ENQUIRY_LEAD_SOURCE
  | typeof CART_SELF_QUOTE_LEAD_SOURCE;

export function quoteLeadSourceFromForm(formData: FormData): QuoteLeadSource {
  const raw = String(formData.get("lead_source") ?? "").trim();
  if (raw === BULK_ENQUIRY_LEAD_SOURCE) {
    return BULK_ENQUIRY_LEAD_SOURCE;
  }
  return WEBSITE_QUOTE_LEAD_SOURCE;
}

export function isBulkEnquirySearchParam(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

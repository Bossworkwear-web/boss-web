/** Customer-facing quote enquiries (mailto from storefront CTAs). */
export const STOREFRONT_QUOTE_EMAIL_RECIPIENT = "bossworkwear@hotmail.com";

export function storefrontQuoteEnquiryMailtoHref(): string {
  const subject = encodeURIComponent("Quote enquiry");
  return `mailto:${STOREFRONT_QUOTE_EMAIL_RECIPIENT}?subject=${subject}`;
}

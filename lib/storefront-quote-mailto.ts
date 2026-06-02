/** Customer-facing sales contact (mailto, contact page, policies). */
export const STOREFRONT_QUOTE_EMAIL_RECIPIENT = "sales@bossworkwear.au";

/** Australian mobile as entered locally (no spaces). */
export const STOREFRONT_PHONE_RAW = "0414828086";

/** Display format for AU mobile. */
export const STOREFRONT_PHONE_DISPLAY = "0414 828 086";

/** E.164 for tel: links and SMS. */
export const STOREFRONT_PHONE_E164 = "+61414828086";

export function storefrontQuoteEnquiryMailtoHref(): string {
  const subject = encodeURIComponent("Quote enquiry");
  return `mailto:${STOREFRONT_QUOTE_EMAIL_RECIPIENT}?subject=${subject}`;
}

export function storefrontBulkOrderMailtoHref(): string {
  const subject = encodeURIComponent("Bulk order — better deal enquiry");
  return `mailto:${STOREFRONT_QUOTE_EMAIL_RECIPIENT}?subject=${subject}`;
}

export function storefrontPhoneTelHref(): string {
  return `tel:${STOREFRONT_PHONE_E164}`;
}

import type { QuoteEmailProductLine } from "@/app/admin/(panel)/crm/quote-email-products";

export type QuoteAcceptCustomerPayload = {
  product_lines: QuoteEmailProductLine[];
  delivery_address_1: string;
  delivery_address_2: string;
  delivery_suburb: string;
  delivery_state: string;
  delivery_country: string;
};

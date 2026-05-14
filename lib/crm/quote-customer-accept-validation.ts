import type { QuoteEmailProductLine } from "@/app/admin/(panel)/crm/quote-email-products";

import type { QuoteAcceptCustomerPayload } from "@/lib/crm/quote-customer-accept-types";

const PRODUCT_KEYS = ["product_id", "product_name", "size", "colour", "price", "quantity"] as const;

function emptyLine(): QuoteEmailProductLine {
  return { product_id: "", product_name: "", size: "", colour: "", price: "", quantity: "" };
}

/** Staff-empty product or delivery slot must have customer value. Address 2 is optional. */
export function getCustomerAcceptValidationError(
  staffLines: QuoteEmailProductLine[],
  customerLines: QuoteEmailProductLine[],
  staffDelivery: {
    address_1: string;
    address_2: string;
    suburb: string;
    state: string;
    country: string;
  },
  customer: QuoteAcceptCustomerPayload,
  options: { comment: string },
): string | null {
  if (customer.product_lines.length !== staffLines.length) {
    return "Invalid form.";
  }

  const n = Math.max(staffLines.length, customerLines.length);
  for (let i = 0; i < n; i++) {
    const s = staffLines[i] ?? emptyLine();
    const c = customerLines[i] ?? emptyLine();
    for (const k of PRODUCT_KEYS) {
      if (!s[k].trim() && !c[k].trim()) {
        return `Complete product line ${i + 1}: ${humanProductKey(k)}.`;
      }
    }
  }

  const pairs: [string, string, string][] = [
    ["Address 1", staffDelivery.address_1, customer.delivery_address_1],
    ["Suburb", staffDelivery.suburb, customer.delivery_suburb],
    ["State", staffDelivery.state, customer.delivery_state],
    ["Country", staffDelivery.country, customer.delivery_country],
  ];
  for (const [label, staffVal, custVal] of pairs) {
    if (!staffVal.trim() && !custVal.trim()) {
      return `Enter ${label} (delivery).`;
    }
  }

  if (!options.comment.trim()) {
    return "Please enter a comment before accepting.";
  }
  if (options.comment.length > 8000) {
    return "Comment is too long (max 8000 characters).";
  }

  return null;
}

function humanProductKey(k: (typeof PRODUCT_KEYS)[number]): string {
  const m: Record<(typeof PRODUCT_KEYS)[number], string> = {
    product_id: "Product ID",
    product_name: "Product name",
    size: "Size",
    colour: "Colour",
    price: "Price per unit",
    quantity: "Quantity",
  };
  return m[k];
}

/** True when Accept may be enabled (same rules as server). */
export function canCustomerAcceptQuote(
  staffLines: QuoteEmailProductLine[],
  customerLines: QuoteEmailProductLine[],
  staffDelivery: {
    address_1: string;
    address_2: string;
    suburb: string;
    state: string;
    country: string;
  },
  customer: QuoteAcceptCustomerPayload,
  comment: string,
): boolean {
  return (
    getCustomerAcceptValidationError(staffLines, customerLines, staffDelivery, customer, { comment }) === null
  );
}

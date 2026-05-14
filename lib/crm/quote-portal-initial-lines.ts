import {
  parseQuoteEmailProductsFromRow,
  type QuoteEmailProductLine,
} from "@/app/admin/(panel)/crm/quote-email-products";

function emptyLine(): QuoteEmailProductLine {
  return { product_id: "", product_name: "", size: "", colour: "", price: "", quantity: "" };
}

/** Same defaults as admin send-quote email draft (catalog enquiry row as seed). */
export function initialQuoteEmailLinesForPortal(row: {
  quote_email_products: unknown;
  quote_email_product_id: string | null;
  quote_email_product_name: string | null;
  product_id: string | null;
  product_name: string | null;
  product_color: string | null;
  quantity: number | null;
}): QuoteEmailProductLine[] {
  const saved = parseQuoteEmailProductsFromRow(
    row.quote_email_products,
    row.quote_email_product_id,
    row.quote_email_product_name,
  );
  const catalogProductId = row.product_id?.trim() ?? "";
  const catalogProductName = row.product_name?.trim() ?? "";
  const catalogProductColour = row.product_color?.trim() ?? "";
  const catalogQuantity =
    row.quantity !== null && row.quantity !== undefined ? String(row.quantity) : "";

  if (saved.length > 0) {
    return saved.map((l) => ({
      product_id: l.product_id,
      product_name: l.product_name,
      size: l.size ?? "",
      colour: l.colour ?? "",
      price: l.price ?? "",
      quantity: l.quantity ?? "",
    }));
  }
  if (
    catalogProductId ||
    catalogProductName ||
    catalogProductColour ||
    catalogQuantity
  ) {
    return [
      {
        product_id: catalogProductId,
        product_name: catalogProductName,
        size: "",
        colour: catalogProductColour,
        price: "",
        quantity: catalogQuantity,
      },
    ];
  }
  return [emptyLine()];
}

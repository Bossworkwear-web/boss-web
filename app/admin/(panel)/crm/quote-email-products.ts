export type QuoteEmailProductLine = {
  product_id: string;
  product_name: string;
  size: string;
  colour: string;
  /** Unit/list price hint for the email (often auto-filled from catalog GST-inclusive retail). */
  price: string;
  quantity: string;
};

/** Parse JSONB `quote_email_products` or fall back to legacy single id/name columns. */
export function parseQuoteEmailProductsFromRow(
  raw: unknown,
  legacyProductId: string | null | undefined,
  legacyProductName: string | null | undefined,
): QuoteEmailProductLine[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const out: QuoteEmailProductLine[] = [];
    for (const item of raw) {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const id =
          typeof o.product_id === "string"
            ? o.product_id
            : typeof o.id === "string"
              ? o.id
              : "";
        const name =
          typeof o.product_name === "string"
            ? o.product_name
            : typeof o.name === "string"
              ? o.name
              : "";
        const size = typeof o.size === "string" ? o.size : "";
        const colour =
          typeof o.colour === "string"
            ? o.colour
            : typeof o.color === "string"
              ? o.color
              : "";
        const price = typeof o.price === "string" ? o.price : "";
        const quantity =
          typeof o.quantity === "string"
            ? o.quantity
            : typeof o.quantity === "number" && Number.isFinite(o.quantity)
              ? String(o.quantity)
              : "";
        out.push({ product_id: id, product_name: name, size, colour, price, quantity });
      }
    }
    if (out.length > 0) return out;
  }

  const lid = legacyProductId?.trim() ?? "";
  const lname = legacyProductName?.trim() ?? "";
  if (lid || lname) {
    return [{ product_id: lid, product_name: lname, size: "", colour: "", price: "", quantity: "" }];
  }

  return [];
}

function lineHasAnyContent(l: QuoteEmailProductLine): boolean {
  return (
    l.product_id.trim().length > 0 ||
    l.product_name.trim().length > 0 ||
    l.size.trim().length > 0 ||
    l.colour.trim().length > 0 ||
    l.price.trim().length > 0 ||
    l.quantity.trim().length > 0
  );
}

/** Trim fields; drop lines where everything is empty. */
export function normalizeQuoteEmailProductsForSave(lines: QuoteEmailProductLine[]): QuoteEmailProductLine[] {
  return lines
    .map((l) => ({
      product_id: l.product_id.trim(),
      product_name: l.product_name.trim(),
      size: l.size.trim(),
      colour: l.colour.trim(),
      price: l.price.trim(),
      quantity: l.quantity.trim(),
    }))
    .filter(lineHasAnyContent);
}

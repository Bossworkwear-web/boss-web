import type { QuoteEmailProductLine } from "@/app/admin/(panel)/crm/quote-email-products";
import { normalizeQuoteEmailProductsForSave } from "@/app/admin/(panel)/crm/quote-email-products";

function emptyLine(): QuoteEmailProductLine {
  return { product_id: "", product_name: "", size: "", colour: "", price: "", quantity: "" };
}

function coalesceField(staff: string, customer: string): string {
  const s = staff.trim();
  if (s) return staff.trim();
  return customer.trim();
}

/** For each field, keep staff value when set; otherwise use customer input. */
export function mergeProductLinesWithCustomer(
  staff: QuoteEmailProductLine[],
  customer: QuoteEmailProductLine[],
): QuoteEmailProductLine[] {
  const n = Math.max(staff.length, customer.length);
  const out: QuoteEmailProductLine[] = [];
  for (let i = 0; i < n; i++) {
    const s = staff[i] ?? emptyLine();
    const c = customer[i] ?? emptyLine();
    out.push({
      product_id: coalesceField(s.product_id, c.product_id),
      product_name: coalesceField(s.product_name, c.product_name),
      size: coalesceField(s.size, c.size),
      colour: coalesceField(s.colour, c.colour),
      price: coalesceField(s.price, c.price),
      quantity: coalesceField(s.quantity, c.quantity),
    });
  }
  return normalizeQuoteEmailProductsForSave(out);
}

export function mergeNullableText(staff: string | null | undefined, customer: string): string | null {
  const s = staff?.trim() ?? "";
  if (s) return staff!.trim();
  const c = customer.trim();
  return c || null;
}

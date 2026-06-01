"use server";

import { cookies } from "next/headers";

import {
  generateCustomerQuoteNumber,
  normalizeCustomerQuoteTotals,
  type CreateCustomerQuotePayload,
  type CustomerQuoteRecord,
} from "@/lib/customer-quote";
import { sendCustomerCartQuoteEmail } from "@/lib/customer-quote-email";
import { currentProductUnitFromRow, repriceQuoteLines, type QuoteLineSnapshot } from "@/lib/customer-quote-pricing";
import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";
import { createSupabaseAdminClient } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Map of productId → current product-only unit price (GST incl.) for the given line product ids. */
async function loadCurrentProductUnitMap(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  lines: { productId?: string }[],
): Promise<Map<string, number>> {
  const ids = [
    ...new Set(
      lines
        .map((l) => (typeof l.productId === "string" ? l.productId.trim() : ""))
        .filter((id) => UUID_RE.test(id)),
    ),
  ];
  const map = new Map<string, number>();
  if (ids.length === 0) {
    return map;
  }
  const { data } = await supabase.from("products").select("id, name, base_price, sale_price").in("id", ids);
  for (const row of data ?? []) {
    const unit = currentProductUnitFromRow(row);
    if (unit != null) {
      map.set(String(row.id), unit);
    }
  }
  return map;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

/** Keep only the fields needed to rebuild a cart line; drop anything else the client sent. */
function sanitizeLine(raw: unknown): QuoteLineSnapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const productName = str(r.productName).trim();
  const quantity = Math.max(1, Math.round(num(r.quantity)));
  if (!productName) return null;

  const line: QuoteLineSnapshot = {
    productId: str(r.productId).trim(),
    productName: productName.slice(0, 300),
    serviceType: str(r.serviceType),
    color: str(r.color),
    size: str(r.size),
    quantity,
    placements: stringArray(r.placements),
    unitPrice: Math.max(0, num(r.unitPrice)),
    totalPrice: Math.max(0, num(r.totalPrice)),
  };

  const supplierName = str(r.supplierName).trim();
  if (supplierName) line.supplierName = supplierName;
  if (typeof r.category === "string") line.category = r.category;
  else if (r.category === null) line.category = null;
  if (typeof r.listUnitPrice !== "undefined") line.listUnitPrice = Math.max(0, num(r.listUnitPrice));
  const notes = str(r.notes).trim();
  if (notes) line.notes = notes;
  const refImgs = stringArray(r.referenceImageUrls);
  if (refImgs.length > 0) line.referenceImageUrls = refImgs;
  const imageUrl = str(r.imageUrl).trim();
  if (imageUrl) line.imageUrl = imageUrl;
  const pathSlug = str(r.productPathSlug).trim();
  if (pathSlug) line.productPathSlug = pathSlug;
  const dealId = str(r.specialDealPackageId).trim();
  if (dealId) line.specialDealPackageId = dealId;
  if (typeof r.productBaseUnit === "number" && Number.isFinite(r.productBaseUnit)) {
    line.productBaseUnit = r.productBaseUnit;
  }

  return line;
}

export type CreateCustomerQuoteResult =
  | { ok: true; quoteNumber: string; emailSent: boolean; emailError?: string }
  | { ok: false; error: string; needsSignIn?: boolean };

/** Save the current cart as a quote for the signed-in customer and email them a copy. */
export async function createCustomerQuoteFromCart(
  payload: CreateCustomerQuotePayload,
): Promise<CreateCustomerQuoteResult> {
  const cookieStore = await cookies();
  const sessionEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  const sessionName = (cookieStore.get("customer_name")?.value ?? "").trim();

  if (!sessionEmail) {
    return { ok: false, error: "Please sign in to email yourself a quote.", needsSignIn: true };
  }

  const lines = Array.isArray(payload?.lines)
    ? payload.lines.map(sanitizeLine).filter((l): l is QuoteLineSnapshot => l !== null)
    : [];

  if (lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  const totals = normalizeCustomerQuoteTotals(payload);
  const quoteNumber = generateCustomerQuoteNumber();

  try {
    const supabase = createSupabaseAdminClient();

    // Snapshot each line's current product-only unit price so we can re-derive the product
    // portion live later (decoration/extra stays fixed).
    const currentUnitByProductId = await loadCurrentProductUnitMap(supabase, lines);
    for (const line of lines) {
      const id = (line.productId ?? "").trim();
      const unit = id ? currentUnitByProductId.get(id) : undefined;
      if (unit != null) {
        line.productBaseUnit = unit;
      }
    }

    const { data, error } = await supabase
      .from("customer_quotes")
      .insert({
        quote_number: quoteNumber,
        customer_email: sessionEmail,
        customer_name: sessionName || null,
        currency: "AUD",
        product_gross_cents: totals.productGrossCents,
        volume_discount_cents: totals.volumeDiscountCents,
        product_net_cents: totals.productNetCents,
        logo_setup_cents: totals.logoSetupCents,
        delivery_cents: totals.deliveryCents,
        total_cents: totals.totalCents,
        total_quantity: totals.totalQuantity,
        pickup: totals.pickup,
        lines: JSON.parse(JSON.stringify(lines)),
      })
      .select("id, quote_number, created_at")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Could not save the quote." };
    }

    const record: CustomerQuoteRecord = {
      id: String(data.id),
      quoteNumber: String(data.quote_number ?? quoteNumber),
      customerEmail: sessionEmail,
      customerName: sessionName || null,
      currency: "AUD",
      createdAt: String(data.created_at ?? new Date().toISOString()),
      lines,
      ...totals,
    };

    const emailResult = await sendCustomerCartQuoteEmail(record);
    return {
      ok: true,
      quoteNumber: record.quoteNumber,
      emailSent: emailResult.ok,
      emailError: emailResult.ok ? undefined : emailResult.error,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export type DeleteCustomerQuoteResult = { ok: true } | { ok: false; error: string };

/** Permanently delete one saved quote owned by the signed-in customer (My account → My Quote). */
export async function deleteCustomerQuote(quoteId: string): Promise<DeleteCustomerQuoteResult> {
  const cookieStore = await cookies();
  const sessionEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  if (!sessionEmail) {
    return { ok: false, error: "Please sign in." };
  }

  const id = quoteId.trim();
  if (!id || !UUID_RE.test(id)) {
    return { ok: false, error: "Invalid quote." };
  }

  const ilikeExact = sessionEmail.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("customer_quotes")
      .delete()
      .eq("id", id)
      .ilike("customer_email", ilikeExact);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete this quote." };
  }
}

export type GetQuoteLinesResult =
  | { ok: true; lines: StoreOrderCartLine[] }
  | { ok: false; error: string };

/** Load a saved quote's lines (owned by the signed-in customer) to rebuild the cart. */
export async function getQuoteLinesForCart(quoteId: string): Promise<GetQuoteLinesResult> {
  const cookieStore = await cookies();
  const sessionEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  if (!sessionEmail) {
    return { ok: false, error: "Please sign in." };
  }

  const id = quoteId.trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid quote." };
  }

  const ilikeExact = sessionEmail.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_quotes")
      .select("id, lines")
      .eq("id", id)
      .ilike("customer_email", ilikeExact)
      .maybeSingle();

    if (error || !data) {
      return { ok: false, error: "Quote not found or access denied." };
    }

    const rawLines = Array.isArray((data as { lines?: unknown }).lines)
      ? ((data as { lines: unknown[] }).lines as unknown[])
      : [];
    const lines = rawLines.map(sanitizeLine).filter((l): l is QuoteLineSnapshot => l !== null);
    if (lines.length === 0) {
      return { ok: false, error: "This quote has no items." };
    }

    // Re-price the cart from current product prices + system rules so saved quotes are not a
    // guaranteed price (see Terms & Conditions §7).
    const currentUnitByProductId = await loadCurrentProductUnitMap(supabase, lines);
    const repriced = repriceQuoteLines(lines, currentUnitByProductId);
    const outLines: StoreOrderCartLine[] = repriced.lines.map(({ productBaseUnit, ...line }) => line);
    return { ok: true, lines: outLines };
  } catch {
    return { ok: false, error: "Something went wrong." };
  }
}

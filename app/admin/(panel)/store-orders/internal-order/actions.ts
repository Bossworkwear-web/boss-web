"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import { parseJsonOrNull, parsePlacementsJsonValue } from "@/lib/safe-json-parse";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type InternalOrderTemplate = {
  baseOrderNumber: string;
  customerEmail: string;
  customerName: string;
  deliveryAddress: string;
  currency: string;
  carrier: string;
  deliveryFeeCents: number;
  /** CRM quote_request company (Customer Quote sheet header). */
  quoteCompanyName?: string;
  /** CRM quote_request phone (Client contact). */
  quoteContactPhone?: string;
  /** Extra UI state when reopening a saved Customer Quote sheet. */
  customerQuoteDraft?: {
    orderDate: string;
    dueDate: string;
    setupFeeCents: number;
    quoteDeliveryFeeCents: number;
    depositCents: number;
    status: "unpaid" | "paid" | "processing" | "shipped" | "cancelled";
  };
  /** Images attached in the Quote box (public storage URLs). */
  quoteBoxImageUrls?: string[];
  /** Note below images in the Quote box. */
  quoteBoxNote?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    serviceType: string | null;
    color: string | null;
    size: string | null;
    placementsJson: string;
    notes: string | null;
    gender?: string | null;
    quoteGroupId?: number | null;
  }>;
};

/** v1 payload stored in `quote_requests.admin_customer_quote_sheet` and posted as `customer_quote_sheet_json`. */
export type AdminCustomerQuoteSheetV1 = {
  v: 1;
  baseOrderNumber: string;
  customerEmail: string;
  customerName: string;
  deliveryAddress: string;
  companyName: string;
  clientContact: string;
  orderDate: string;
  dueDate: string;
  setupFeeCents: number;
  quoteDeliveryFeeCents: number;
  depositCents: number;
  currency: string;
  carrier: string;
  status: "unpaid" | "paid" | "processing" | "shipped" | "cancelled";
  quoteBoxImageUrls?: string[];
  quoteBoxNote?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    serviceType: string | null;
    color: string | null;
    size: string | null;
    placementsJson: string;
    notes: string | null;
    gender: string;
    quoteGroupId: number;
  }>;
};

function safeInt(raw: unknown, fallback = 0): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function normalizeText(raw: unknown): string {
  return String(raw ?? "").trim();
}

function normalizeNullableText(raw: unknown): string | null {
  const s = normalizeText(raw);
  return s.length ? s : null;
}

function normalizePlacementsJson(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "[]";
  const parsed = parseJsonOrNull(s);
  if (parsed === null) {
    // Keep as-is; DB insert will fail if invalid.
    return s;
  }
  return JSON.stringify(parsed);
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive exact match for Postgres `ILIKE` (escape % and _). */
function escapeIlikeExact(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function isUuid(raw: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.trim());
}

function nextInternalOrderBasePrefix(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = randomBytes(3).toString("hex");
  return `INT_${y}${m}${day}_${rand}`;
}

export async function loadInternalOrderTemplate(formData: FormData): Promise<void> {
  const orderNumber = normalizeText(formData.get("order_number"));
  const customerId = normalizeText(formData.get("customer_id"));
  const companyName = normalizeText(formData.get("company_name"));

  if (orderNumber) {
    redirect(`/admin/store-orders/internal-order?from=${encodeURIComponent(orderNumber)}`);
  }
  if (customerId && companyName) {
    redirect(
      `/admin/store-orders/internal-order?customer_id=${encodeURIComponent(customerId)}&company=${encodeURIComponent(companyName)}`,
    );
  }
  redirect("/admin/store-orders/internal-order?error=missing_lookup_fields");
}

/** Same as {@link loadInternalOrderTemplate} but redirects into Customer Quote. */
export async function loadCustomerQuoteTemplate(formData: FormData): Promise<void> {
  const orderNumber = normalizeText(formData.get("order_number"));
  const customerId = normalizeText(formData.get("customer_id"));
  const companyName = normalizeText(formData.get("company_name"));

  if (orderNumber) {
    redirect(`/admin/customer-quote?from=${encodeURIComponent(orderNumber)}`);
  }
  if (customerId && companyName) {
    redirect(
      `/admin/customer-quote?customer_id=${encodeURIComponent(customerId)}&company=${encodeURIComponent(companyName)}`,
    );
  }
  redirect("/admin/customer-quote?error=missing_lookup_fields");
}

export async function createInternalOrderFromTemplate(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const source = normalizeText(formData.get("source"));
  const useQuotePricing = source === "customer-quote" || source === "internal-quote";
  const returnBase =
    source === "customer-quote" ? "/admin/customer-quote" : "/admin/store-orders/internal-order";

  let baseOrderNumber = normalizeText(formData.get("base_order_number"));
  if (!baseOrderNumber) {
    baseOrderNumber = nextInternalOrderBasePrefix();
  }

  const customerEmail = normalizeText(formData.get("customer_email"));
  const customerName = normalizeText(formData.get("customer_name"));
  const deliveryAddress = normalizeText(formData.get("delivery_address"));
  const currency = normalizeText(formData.get("currency")) || "AUD";
  const carrier = normalizeText(formData.get("carrier")) || "Australia Post";
  const status = normalizeText(formData.get("status")) || "paid";
  let deliveryFeeCents = Math.max(0, safeInt(formData.get("delivery_fee_cents"), 0));

  const itemsRaw = normalizeText(formData.get("items_json"));
  const parsedItems = parseJsonOrNull(itemsRaw);
  let items: InternalOrderTemplate["items"] = [];
  try {
    if (!parsedItems || !Array.isArray(parsedItems)) throw new Error("items_json must be an array");
    items = parsedItems.map((r) => {
      const rec = r as Record<string, unknown>;
      const gender = normalizeNullableText(rec.gender);
      const baseNotes = normalizeNullableText(rec.notes);
      const notes =
        gender === "M" || gender === "F"
          ? `${gender}${baseNotes ? ` ${baseNotes}` : ""}`.trim() || null
          : baseNotes;
      return {
        productId: normalizeText(rec.productId),
        productName: normalizeText(rec.productName),
        quantity: Math.max(0, safeInt(rec.quantity, 0)),
        unitPriceCents: Math.max(0, safeInt(rec.unitPriceCents, 0)),
        lineTotalCents: Math.max(0, safeInt(rec.lineTotalCents, 0)),
        serviceType: normalizeNullableText(rec.serviceType),
        color: normalizeNullableText(rec.color),
        size: normalizeNullableText(rec.size),
        placementsJson: normalizePlacementsJson(rec.placementsJson),
        notes,
      };
    });
  } catch {
    redirect(`${returnBase}?error=invalid_items_json`);
  }

  if (!customerEmail || !customerName || !deliveryAddress) {
    redirect(`${returnBase}?error=missing_fields`);
  }
  if (items.length === 0) {
    redirect(`${returnBase}?error=no_items`);
  }

  const linesSubtotalCents = items.reduce((sum, it) => sum + Math.max(0, safeInt(it.lineTotalCents, 0)), 0);
  let subtotalCents = linesSubtotalCents;
  let totalCents = linesSubtotalCents + deliveryFeeCents;

  if (useQuotePricing) {
    const setupFeeCents = Math.max(0, safeInt(formData.get("quote_setup_fee_cents"), 0));
    const quoteDeliveryFeeCents = Math.max(0, safeInt(formData.get("quote_delivery_fee_cents"), 0));
    const depositCents = Math.max(0, safeInt(formData.get("quote_deposit_cents"), 0));
    const taxableSubtotalCents = linesSubtotalCents + setupFeeCents + quoteDeliveryFeeCents;
    const gstCents = Math.round(taxableSubtotalCents * 0.1);
    subtotalCents = taxableSubtotalCents;
    deliveryFeeCents = gstCents;
    totalCents = taxableSubtotalCents + gstCents - depositCents;
  }

  const supabase = createSupabaseAdminClient();

  // Determine next suffix: base_1, base_2, ... (based on existing rows).
  const { data: existing, error: listErr } = await supabase
    .from("store_orders")
    .select("order_number")
    .ilike("order_number", `${baseOrderNumber}\\_%`)
    .limit(2000);
  if (listErr) {
    const short = listErr.message.length > 700 ? `${listErr.message.slice(0, 700)}…` : listErr.message;
    redirect(`${returnBase}?error=${encodeURIComponent(short)}`);
  }

  const re = new RegExp(`^${escapeRegExp(baseOrderNumber)}_([0-9]+)$`);
  let max = 0;
  for (const row of existing ?? []) {
    const s = (row as { order_number?: string }).order_number ?? "";
    const m = s.match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const next = max + 1;
  const newOrderNumber = `${baseOrderNumber}_${next}`;

  const { data: orderRow, error: insErr } = await supabase
    .from("store_orders")
    .insert({
      order_number: newOrderNumber,
      status,
      customer_email: customerEmail,
      customer_name: customerName,
      delivery_address: deliveryAddress,
      delivery_fee_cents: deliveryFeeCents,
      subtotal_cents: subtotalCents,
      total_cents: totalCents,
      currency,
      carrier,
      tracking_number: null,
      shipped_at: null,
    })
    .select("id")
    .single();

  if (insErr || !orderRow?.id) {
    const msg = insErr?.message ?? "Could not create order";
    const short = msg.length > 700 ? `${msg.slice(0, 700)}…` : msg;
    redirect(`${returnBase}?error=${encodeURIComponent(short)}`);
  }

  const orderId = orderRow.id as string;
  const itemRows = items.map((it, idx) => ({
    order_id: orderId,
    product_id: it.productId ?? "",
    product_name: it.productName,
    quantity: Math.max(0, safeInt(it.quantity, 0)),
    unit_price_cents: Math.max(0, safeInt(it.unitPriceCents, 0)),
    line_total_cents: Math.max(0, safeInt(it.lineTotalCents, 0)),
    service_type: it.serviceType,
    color: it.color,
    size: it.size,
    placements: parsePlacementsJsonValue(it.placementsJson),
    notes: it.notes,
    sort_order: idx,
  }));

  const { error: itemsErr } = await supabase.from("store_order_items").insert(itemRows);
  if (itemsErr) {
    await supabase.from("store_orders").delete().eq("id", orderId);
    const short = itemsErr.message.length > 700 ? `${itemsErr.message.slice(0, 700)}…` : itemsErr.message;
    redirect(`${returnBase}?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/store-orders");
  revalidatePath("/admin/customer-quote");
  redirect(`${returnBase}?created=${encodeURIComponent(newOrderNumber)}`);
}

function parseAdminCustomerQuoteSheetFromUnknown(parsed: unknown): AdminCustomerQuoteSheetV1 {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid_sheet");
  }
  const o = parsed as Record<string, unknown>;
  if (o.v !== 1) {
    throw new Error("invalid_sheet_version");
  }
  const itemsRaw = o.items;
  if (!Array.isArray(itemsRaw)) {
    throw new Error("invalid_sheet_items");
  }
  const items = itemsRaw.map((row) => {
    const rec = row as Record<string, unknown>;
    return {
      productId: normalizeText(rec.productId),
      productName: normalizeText(rec.productName),
      quantity: Math.max(0, safeInt(rec.quantity, 0)),
      unitPriceCents: Math.max(0, safeInt(rec.unitPriceCents, 0)),
      lineTotalCents: Math.max(0, safeInt(rec.lineTotalCents, 0)),
      serviceType: normalizeNullableText(rec.serviceType),
      color: normalizeNullableText(rec.color),
      size: normalizeNullableText(rec.size),
      placementsJson: normalizePlacementsJson(rec.placementsJson),
      notes: normalizeNullableText(rec.notes),
      gender: normalizeText(rec.gender),
      quoteGroupId: Math.max(1, safeInt(rec.quoteGroupId, 1)),
    };
  });
  const statusRaw = normalizeText(o.status) || "unpaid";
  const status =
    statusRaw === "paid" ||
    statusRaw === "unpaid" ||
    statusRaw === "processing" ||
    statusRaw === "shipped" ||
    statusRaw === "cancelled"
      ? statusRaw
      : "unpaid";
  return {
    v: 1,
    baseOrderNumber: normalizeText(o.baseOrderNumber),
    customerEmail: normalizeText(o.customerEmail),
    customerName: normalizeText(o.customerName),
    deliveryAddress: normalizeText(o.deliveryAddress),
    companyName: normalizeText(o.companyName),
    clientContact: normalizeText(o.clientContact),
    orderDate: normalizeText(o.orderDate),
    dueDate: normalizeText(o.dueDate),
    setupFeeCents: Math.max(0, safeInt(o.setupFeeCents, 0)),
    quoteDeliveryFeeCents: Math.max(0, safeInt(o.quoteDeliveryFeeCents, 0)),
    depositCents: Math.max(0, safeInt(o.depositCents, 0)),
    currency: normalizeText(o.currency) || "AUD",
    carrier: normalizeText(o.carrier) || "Australia Post",
    status,
    quoteBoxImageUrls: parseQuoteBoxImageUrls(o.quoteBoxImageUrls),
    quoteBoxNote: normalizeText(o.quoteBoxNote),
    items,
  };
}

function parseAdminCustomerQuoteSheetFromForm(formData: FormData): AdminCustomerQuoteSheetV1 {
  const raw = normalizeText(formData.get("customer_quote_sheet_json"));
  if (!raw) {
    throw new Error("missing_sheet");
  }
  const parsed = parseJsonOrNull(raw);
  if (parsed === null) {
    throw new Error("invalid_sheet_json");
  }
  return parseAdminCustomerQuoteSheetFromUnknown(parsed);
}

function normalizeAdminCustomerQuoteSheet(sheet: AdminCustomerQuoteSheetV1): AdminCustomerQuoteSheetV1 {
  return parseAdminCustomerQuoteSheetFromUnknown(sheet);
}

function parseQuoteBoxImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const u = x.trim();
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

function adminSheetToInternalTemplate(sheet: AdminCustomerQuoteSheetV1): InternalOrderTemplate {
  return {
    baseOrderNumber: sheet.baseOrderNumber,
    customerEmail: sheet.customerEmail,
    customerName: sheet.customerName,
    deliveryAddress: sheet.deliveryAddress,
    currency: sheet.currency,
    carrier: sheet.carrier,
    deliveryFeeCents: sheet.quoteDeliveryFeeCents,
    quoteCompanyName: sheet.companyName || undefined,
    quoteContactPhone: sheet.clientContact || undefined,
    customerQuoteDraft: {
      orderDate: sheet.orderDate,
      dueDate: sheet.dueDate,
      setupFeeCents: sheet.setupFeeCents,
      quoteDeliveryFeeCents: sheet.quoteDeliveryFeeCents,
      depositCents: sheet.depositCents,
      status: sheet.status === "paid" || sheet.status === "unpaid" ? sheet.status : "unpaid",
    },
    quoteBoxImageUrls: sheet.quoteBoxImageUrls ?? [],
    quoteBoxNote: sheet.quoteBoxNote ?? "",
    items: sheet.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      lineTotalCents: it.lineTotalCents,
      serviceType: it.serviceType,
      color: it.color,
      size: it.size,
      placementsJson: it.placementsJson,
      notes: it.notes,
      gender: it.gender || null,
      quoteGroupId: it.quoteGroupId,
    })),
  };
}

function resolveQuoteSaveReturnBase(returnBaseInput: string | null | undefined): string {
  const allowedReturn = new Set(["/admin/customer-quote", "/admin/store-orders/internal-order"]);
  const raw = normalizeText(returnBaseInput);
  return allowedReturn.has(raw) ? raw : "/admin/customer-quote";
}

/** Save Customer Quote spreadsheet to `quote_requests` (list + reopen). Does not create a store order. */
export async function saveCustomerQuoteSheet(
  sheet: AdminCustomerQuoteSheetV1,
  quoteRequestId: string | null = null,
  returnBaseInput?: string | null,
): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const returnBase = resolveQuoteSaveReturnBase(returnBaseInput);
  const normalized = normalizeAdminCustomerQuoteSheet(sheet);

  if (!normalized.customerEmail || !normalized.customerName || !normalized.deliveryAddress.trim()) {
    redirect(`${returnBase}?error=missing_fields`);
  }
  if (normalized.items.length === 0) {
    redirect(`${returnBase}?error=no_items`);
  }

  const supabase = createSupabaseAdminClient();
  const existingId = normalizeText(quoteRequestId ?? "");

  const companyName = normalized.companyName.trim() || normalized.customerName.trim() || "Quote draft";
  const first = normalized.items[0]!;
  const legacyProductId = isUuid(first.productId) ? first.productId : null;
  const legacyQty =
    normalized.items.reduce((s, it) => s + Math.max(0, safeInt(it.quantity, 0)), 0) || null;

  if (existingId && isUuid(existingId)) {
    const { error: upErr } = await supabase
      .from("quote_requests")
      .update({
        company_name: companyName,
        contact_name: normalized.customerName,
        email: normalized.customerEmail,
        phone: normalized.clientContact.trim() ? normalized.clientContact.trim() : null,
        product_id: legacyProductId,
        quantity: legacyQty,
        service_type: first.serviceType,
        product_color: first.color,
        notes: first.notes,
        admin_customer_quote_sheet: normalized,
      })
      .eq("id", existingId);
    if (upErr) {
      const short = upErr.message.length > 700 ? `${upErr.message.slice(0, 700)}…` : upErr.message;
      redirect(`${returnBase}?error=${encodeURIComponent(short)}`);
    }
    revalidatePath("/admin/customer-quote");
    revalidatePath("/admin/store-orders/internal-order");
    redirect(`${returnBase}?quote_id=${encodeURIComponent(existingId)}&quote_saved=1`);
  }

  const { data: ins, error: insErr } = await supabase
    .from("quote_requests")
    .insert({
      company_name: companyName,
      contact_name: normalized.customerName,
      email: normalized.customerEmail,
      phone: normalized.clientContact.trim() ? normalized.clientContact.trim() : null,
      product_id: legacyProductId,
      quantity: legacyQty,
      service_type: first.serviceType,
      product_color: first.color,
      notes: first.notes,
      lead_source: "admin_customer_quote",
      admin_customer_quote_sheet: normalized,
    })
    .select("id")
    .single();

  if (insErr || !ins?.id) {
    const msg = insErr?.message ?? "Could not save quote";
    const short = msg.length > 700 ? `${msg.slice(0, 700)}…` : msg;
    redirect(`${returnBase}?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/customer-quote");
  revalidatePath("/admin/store-orders/internal-order");
  redirect(`${returnBase}?quote_id=${encodeURIComponent(String(ins.id))}&quote_saved=1`);
}

/**
 * Latest `store_orders` row for the profile email, after verifying `customer_profiles.id`
 * and organisation (company name) match.
 */
export async function getTemplateByCustomerIdAndCompany(
  customerId: string,
  companyName: string,
): Promise<InternalOrderTemplate> {
  try {
    await assertAdminSession();
  } catch {
    throw new Error("Unauthorized");
  }

  const id = customerId.trim();
  const company = companyName.trim();
  if (!id || !isUuid(id)) {
    throw new Error("Invalid customer ID (UUID expected)");
  }
  if (!company) {
    throw new Error("Company name is required");
  }

  const supabase = createSupabaseAdminClient();
  const { data: prof, error: pErr } = await supabase
    .from("customer_profiles")
    .select("id, email_address, organisation")
    .eq("id", id)
    .maybeSingle();

  if (pErr || !prof) {
    throw new Error(pErr?.message ?? "Customer not found");
  }

  const profileOrg = normalizeText(prof.organisation);
  if (profileOrg.toLowerCase() !== company.toLowerCase()) {
    throw new Error("Company name does not match this customer profile");
  }

  const email = normalizeText(prof.email_address);
  if (!email) {
    throw new Error("Customer profile has no email address");
  }

  const emailPattern = escapeIlikeExact(email);
  const { data: orders, error: oErr } = await supabase
    .from("store_orders")
    .select("order_number")
    .ilike("customer_email", emailPattern)
    .order("created_at", { ascending: false })
    .limit(1);

  if (oErr) {
    throw new Error(oErr.message);
  }
  const latest = orders?.[0];
  const on = latest?.order_number != null ? String(latest.order_number).trim() : "";
  if (!on) {
    throw new Error("No store order found for this customer");
  }

  return getTemplateByOrderNumber(on);
}

export async function getTemplateByOrderNumber(orderNumber: string): Promise<InternalOrderTemplate> {
  try {
    await assertAdminSession();
  } catch {
    throw new Error("Unauthorized");
  }
  const n = orderNumber.trim();
  if (!n) {
    throw new Error("Missing order number");
  }

  const supabase = createSupabaseAdminClient();
  const { data: order, error: oErr } = await supabase
    .from("store_orders")
    .select(
      "id, order_number, customer_email, customer_name, delivery_address, currency, carrier, delivery_fee_cents",
    )
    .eq("order_number", n)
    .maybeSingle();
  if (oErr || !order) {
    throw new Error(oErr?.message ?? "Order not found");
  }

  const { data: lines, error: lErr } = await supabase
    .from("store_order_items")
    .select(
      "product_id, product_name, quantity, unit_price_cents, line_total_cents, service_type, color, size, placements, notes, sort_order",
    )
    .eq("order_id", order.id)
    .order("sort_order", { ascending: true });
  if (lErr) {
    throw new Error(lErr.message);
  }

  return {
    baseOrderNumber: order.order_number,
    customerEmail: order.customer_email,
    customerName: order.customer_name,
    deliveryAddress: order.delivery_address,
    currency: order.currency ?? "AUD",
    carrier: order.carrier ?? "Australia Post",
    deliveryFeeCents: typeof order.delivery_fee_cents === "number" ? order.delivery_fee_cents : 0,
    items: (lines ?? []).map((l) => ({
      productId: (l.product_id ?? "").toString(),
      productName: (l.product_name ?? "").toString(),
      quantity: typeof l.quantity === "number" ? l.quantity : 0,
      unitPriceCents: typeof l.unit_price_cents === "number" ? l.unit_price_cents : 0,
      lineTotalCents: typeof l.line_total_cents === "number" ? l.line_total_cents : 0,
      serviceType: (l.service_type ?? null) as string | null,
      color: (l.color ?? null) as string | null,
      size: (l.size ?? null) as string | null,
      placementsJson: (() => {
        try {
          return JSON.stringify(l.placements ?? []);
        } catch {
          return "[]";
        }
      })(),
      notes: (l.notes ?? null) as string | null,
    })),
  };
}

type QuoteRequestRowForInternalOrder = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  product_id: string | null;
  quantity: number | null;
  service_type: string | null;
  product_color: string | null;
  notes: string | null;
  placement_labels: string[] | null;
  products: { name: string } | null;
  embroidery_position_id: string | null;
  embroidery_position_ids: string[] | null;
  printing_position_id: string | null;
  printing_position_ids: string[] | null;
  customer_profiles: { delivery_address: string; billing_address: string } | null;
};

function uniqOrderedPositionIds(ids: string[] | null | undefined, fallbackSingle: string | null): string[] {
  const raw =
    ids && ids.length > 0 ? ids.map((x) => String(x)) : fallbackSingle ? [String(fallbackSingle)] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    const t = normalizeText(id);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Prefill internal order form from a website CRM quote_request (admin only). */
export async function getTemplateFromQuoteRequest(quoteRequestId: string): Promise<InternalOrderTemplate> {
  try {
    await assertAdminSession();
  } catch {
    throw new Error("Unauthorized");
  }

  const id = quoteRequestId.trim();
  if (!isUuid(id)) {
    throw new Error("Invalid quote request id");
  }

  const supabase = createSupabaseAdminClient();
  const { data: qr, error } = await supabase
    .from("quote_requests")
    .select(
      `
      id,
      company_name,
      contact_name,
      email,
      phone,
      product_id,
      quantity,
      service_type,
      product_color,
      notes,
      placement_labels,
      embroidery_position_id,
      embroidery_position_ids,
      printing_position_id,
      printing_position_ids,
      admin_customer_quote_sheet,
      products ( name ),
      customer_profiles ( delivery_address, billing_address )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!qr) {
    throw new Error("Quote request not found");
  }

  const row = qr as unknown as QuoteRequestRowForInternalOrder & {
    admin_customer_quote_sheet?: unknown;
  };

  const sheetRaw = row.admin_customer_quote_sheet;
  if (sheetRaw && typeof sheetRaw === "object") {
    const cand = sheetRaw as Record<string, unknown>;
    if (cand.v === 1 && Array.isArray(cand.items) && cand.items.length > 0) {
      try {
        const fd = new FormData();
        fd.set("customer_quote_sheet_json", JSON.stringify(sheetRaw));
        const sheet = parseAdminCustomerQuoteSheetFromForm(fd);
        if (sheet.customerEmail.trim() && sheet.items.length > 0) {
          return adminSheetToInternalTemplate(sheet);
        }
      } catch {
        // Fall through to CRM-derived template.
      }
    }
  }

  const rowCrm = row as unknown as QuoteRequestRowForInternalOrder;
  const email = normalizeText(rowCrm.email);
  if (!email) {
    throw new Error("Quote request has no email");
  }

  const embIds = uniqOrderedPositionIds(rowCrm.embroidery_position_ids, rowCrm.embroidery_position_id);
  const prtIds = uniqOrderedPositionIds(rowCrm.printing_position_ids, rowCrm.printing_position_id);
  const allPosIds = [...embIds, ...prtIds].filter((id, i, a) => a.indexOf(id) === i);

  let posNameById = new Map<string, string>();
  if (allPosIds.length > 0) {
    const { data: posRows } = await supabase.from("embroidery_positions").select("id, name").in("id", allPosIds);
    posNameById = new Map((posRows ?? []).map((p) => [String(p.id), normalizeText(p.name)]));
  }

  const placementLines: string[] = [];
  for (const id of embIds) {
    placementLines.push(`Embroidery: ${posNameById.get(id) || id}`);
  }
  for (const id of prtIds) {
    placementLines.push(`Printing: ${posNameById.get(id) || id}`);
  }
  for (const raw of rowCrm.placement_labels ?? []) {
    const t = String(raw).trim();
    if (t) placementLines.push(t);
  }

  const productName =
    rowCrm.products?.name?.trim() || "Quoted product — confirm catalog name / SKU";
  const qty =
    typeof rowCrm.quantity === "number" && Number.isFinite(rowCrm.quantity) && rowCrm.quantity > 0
      ? rowCrm.quantity
      : 1;

  const delivery =
    rowCrm.customer_profiles?.delivery_address?.trim() ||
    rowCrm.customer_profiles?.billing_address?.trim() ||
    `Address to be confirmed (CRM quote ${rowCrm.id.slice(0, 8)}…). Company: ${normalizeText(rowCrm.company_name)}. Phone: ${normalizeText(rowCrm.phone) || "—"}.`;

  const notesLines = [
    `CRM quote request: ${rowCrm.id}`,
    rowCrm.notes?.trim() || null,
    `Quote company: ${normalizeText(rowCrm.company_name)}`,
  ].filter(Boolean) as string[];

  return {
    baseOrderNumber: "",
    customerEmail: email,
    customerName: normalizeText(rowCrm.contact_name) || normalizeText(rowCrm.company_name) || "Quote contact",
    quoteCompanyName: normalizeText(rowCrm.company_name) || undefined,
    quoteContactPhone: normalizeText(rowCrm.phone) || undefined,
    deliveryAddress: delivery,
    currency: "AUD",
    carrier: "Australia Post",
    deliveryFeeCents: 0,
    items: [
      {
        productId: rowCrm.product_id?.trim() ?? "",
        productName,
        quantity: qty,
        unitPriceCents: 0,
        lineTotalCents: 0,
        serviceType: rowCrm.service_type?.trim() ? rowCrm.service_type.trim() : null,
        color: rowCrm.product_color?.trim() ? rowCrm.product_color.trim() : null,
        size: null,
        placementsJson: JSON.stringify(placementLines),
        notes: notesLines.join("\n\n"),
      },
    ],
  };
}


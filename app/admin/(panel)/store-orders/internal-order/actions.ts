"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type InternalOrderTemplate = {
  baseOrderNumber: string;
  customerEmail: string;
  customerName: string;
  deliveryAddress: string;
  currency: string;
  carrier: string;
  deliveryFeeCents: number;
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
  try {
    const parsed = JSON.parse(s);
    return JSON.stringify(parsed);
  } catch {
    // Keep as-is; DB insert will fail if invalid.
    return s;
  }
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

export async function createInternalOrderFromTemplate(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

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
  const deliveryFeeCents = Math.max(0, safeInt(formData.get("delivery_fee_cents"), 0));

  const itemsRaw = normalizeText(formData.get("items_json"));
  let items: InternalOrderTemplate["items"] = [];
  try {
    const parsed = JSON.parse(itemsRaw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("items_json must be an array");
    items = parsed.map((r) => {
      const rec = r as Record<string, unknown>;
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
      };
    });
  } catch {
    redirect("/admin/store-orders/internal-order?error=invalid_items_json");
  }

  if (!customerEmail || !customerName || !deliveryAddress) {
    redirect("/admin/store-orders/internal-order?error=missing_fields");
  }
  if (items.length === 0) {
    redirect("/admin/store-orders/internal-order?error=no_items");
  }

  const subtotalCents = items.reduce((sum, it) => sum + Math.max(0, safeInt(it.lineTotalCents, 0)), 0);
  const totalCents = subtotalCents + deliveryFeeCents;

  const supabase = createSupabaseAdminClient();

  // Determine next suffix: base_1, base_2, ... (based on existing rows).
  const { data: existing, error: listErr } = await supabase
    .from("store_orders")
    .select("order_number")
    .ilike("order_number", `${baseOrderNumber}\\_%`)
    .limit(2000);
  if (listErr) {
    const short = listErr.message.length > 700 ? `${listErr.message.slice(0, 700)}…` : listErr.message;
    redirect(`/admin/store-orders/internal-order?error=${encodeURIComponent(short)}`);
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
    redirect(`/admin/store-orders/internal-order?error=${encodeURIComponent(short)}`);
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
    placements: (() => {
      try {
        return JSON.parse(it.placementsJson) as unknown;
      } catch {
        return [];
      }
    })(),
    notes: it.notes,
    sort_order: idx,
  }));

  const { error: itemsErr } = await supabase.from("store_order_items").insert(itemRows);
  if (itemsErr) {
    await supabase.from("store_orders").delete().eq("id", orderId);
    const short = itemsErr.message.length > 700 ? `${itemsErr.message.slice(0, 700)}…` : itemsErr.message;
    redirect(`/admin/store-orders/internal-order?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/store-orders");
  redirect(`/admin/store-orders/internal-order?created=${encodeURIComponent(newOrderNumber)}`);
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

  const row = qr as unknown as QuoteRequestRowForInternalOrder;
  const email = normalizeText(row.email);
  if (!email) {
    throw new Error("Quote request has no email");
  }

  const embIds = uniqOrderedPositionIds(row.embroidery_position_ids, row.embroidery_position_id);
  const prtIds = uniqOrderedPositionIds(row.printing_position_ids, row.printing_position_id);
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
  for (const raw of row.placement_labels ?? []) {
    const t = String(raw).trim();
    if (t) placementLines.push(t);
  }

  const productName =
    row.products?.name?.trim() || "Quoted product — confirm catalog name / SKU";
  const qty =
    typeof row.quantity === "number" && Number.isFinite(row.quantity) && row.quantity > 0 ? row.quantity : 1;

  const delivery =
    row.customer_profiles?.delivery_address?.trim() ||
    row.customer_profiles?.billing_address?.trim() ||
    `Address to be confirmed (CRM quote ${row.id.slice(0, 8)}…). Company: ${normalizeText(row.company_name)}. Phone: ${normalizeText(row.phone) || "—"}.`;

  const notesLines = [
    `CRM quote request: ${row.id}`,
    row.notes?.trim() || null,
    `Quote company: ${normalizeText(row.company_name)}`,
  ].filter(Boolean) as string[];

  return {
    baseOrderNumber: "",
    customerEmail: email,
    customerName: normalizeText(row.contact_name) || normalizeText(row.company_name) || "Quote contact",
    deliveryAddress: delivery,
    currency: "AUD",
    carrier: "Australia Post",
    deliveryFeeCents: 0,
    items: [
      {
        productId: row.product_id?.trim() ?? "",
        productName,
        quantity: qty,
        unitPriceCents: 0,
        lineTotalCents: 0,
        serviceType: row.service_type?.trim() ? row.service_type.trim() : null,
        color: row.product_color?.trim() ? row.product_color.trim() : null,
        size: null,
        placementsJson: JSON.stringify(placementLines),
        notes: notesLines.join("\n\n"),
      },
    ],
  };
}


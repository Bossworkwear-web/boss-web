"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import {
  INSTORE_WALK_IN_CASH_SALE_DISCOUNT_RATE,
  INSTORE_WALK_IN_LOCATIONS,
  INSTORE_WALK_IN_LOGO_SETUP_FEE_AUD,
  INSTORE_WALK_IN_PICKUP_ADDRESS,
} from "@/lib/instore-walk-in-constants";
import { parsePlacementsJsonValue } from "@/lib/safe-json-parse";
import {
  mergeNotesWithReferenceImageUrls,
  sanitizeStoreOrderReferenceImageUrls,
} from "@/lib/store-order-reference-image-urls";
import { createSupabaseAdminClient } from "@/lib/supabase";

function normalizeText(raw: FormDataEntryValue | null | undefined): string {
  return String(raw ?? "").trim();
}

function safeInt(raw: FormDataEntryValue | null | undefined, fallback = 0): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function parseAudToCents(raw: string): number {
  const s = raw.replace(/^\$/, "").replace(/,/g, "").trim();
  if (!s) return 0;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nextInstoreOrderBasePrefix(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = randomBytes(3).toString("hex");
  return `INT_${y}${m}${day}_${rand}`;
}

function resolveCustomerEmail(email: string, phone: string): string {
  const e = email.trim().toLowerCase();
  if (e.includes("@")) return e;
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 8) return `instore+${digits}@instore.bossworkwear.au`;
  return `instore+${Date.now()}@instore.bossworkwear.au`;
}

type WalkInLine = {
  description: string;
  serviceType: string;
  location: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
  notes: string;
};

function parseWalkInLocation(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return (INSTORE_WALK_IN_LOCATIONS as readonly string[]).includes(v) ? v : "";
}

function parseWalkInLines(formData: FormData): WalkInLine[] {
  const count = Math.max(0, safeInt(formData.get("line_count"), 0));
  const lines: WalkInLine[] = [];
  for (let i = 0; i < count; i++) {
    const description = normalizeText(formData.get(`line_${i}_description`));
    const serviceType = normalizeText(formData.get(`line_${i}_service`));
    const location = parseWalkInLocation(normalizeText(formData.get(`line_${i}_location`)));
    const color = normalizeText(formData.get(`line_${i}_color`));
    const size = normalizeText(formData.get(`line_${i}_size`));
    const quantity = Math.max(1, safeInt(formData.get(`line_${i}_qty`), 1));
    const unitPriceCents = parseAudToCents(normalizeText(formData.get(`line_${i}_unit_aud`)));
    let notes = normalizeText(formData.get(`line_${i}_notes`));
    const imageUrlsRaw = normalizeText(formData.get(`line_${i}_image_urls`));
    let imageUrls: string[] = [];
    if (imageUrlsRaw) {
      try {
        imageUrls = sanitizeStoreOrderReferenceImageUrls(JSON.parse(imageUrlsRaw));
      } catch {
        imageUrls = [];
      }
    }
    if (imageUrls.length > 0) {
      notes = mergeNotesWithReferenceImageUrls(notes, imageUrls) ?? notes;
    }
    const hasContent =
      description || serviceType || color || size || notes || unitPriceCents > 0 || imageUrls.length > 0;
    if (!hasContent) continue;
    if (!description) {
      throw new Error(`Line ${i + 1}: enter a garment / item description.`);
    }
    lines.push({
      description,
      serviceType,
      location,
      color,
      size,
      quantity,
      unitPriceCents,
      notes: notes || "",
    });
  }
  return lines;
}

export async function createInstoreWalkInOrder(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login?from=/instore_order");
  }

  const customerName = normalizeText(formData.get("customer_name"));
  const customerPhone = normalizeText(formData.get("customer_phone"));
  const dueDate = normalizeText(formData.get("due_date"));
  const orderNotes = normalizeText(formData.get("order_notes"));
  const cashSale = formData.get("cash_sale") === "1";
  const logoSetup = formData.get("logo_setup") === "1";
  const pickup = formData.get("fulfilment") === "pickup";
  const deliveryAddress = pickup
    ? INSTORE_WALK_IN_PICKUP_ADDRESS
    : normalizeText(formData.get("delivery_address")) || INSTORE_WALK_IN_PICKUP_ADDRESS;

  if (!customerName) {
    redirect("/instore_order?error=missing_name");
  }
  if (!customerPhone) {
    redirect("/instore_order?error=missing_contact");
  }

  let lines: WalkInLine[] = [];
  try {
    lines = parseWalkInLines(formData);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid line items.";
    redirect(`/instore_order?error=${encodeURIComponent(msg)}`);
  }

  if (lines.length === 0) {
    redirect("/instore_order?error=no_items");
  }

  const customerEmail = resolveCustomerEmail("", customerPhone);
  const linesSubtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const logoSetupCents = logoSetup ? Math.round(INSTORE_WALK_IN_LOGO_SETUP_FEE_AUD * 100) : 0;
  const linesTotalCents = cashSale
    ? Math.round(linesSubtotalCents * (1 - INSTORE_WALK_IN_CASH_SALE_DISCOUNT_RATE))
    : linesSubtotalCents;
  const subtotalCents = linesSubtotalCents + logoSetupCents;
  const totalCents = linesTotalCents + logoSetupCents;

  const headerNotes = [
    customerPhone ? `Phone: ${customerPhone}` : "",
    dueDate ? `Due: ${dueDate}` : "",
    cashSale ? `Cash sale (${Math.round(INSTORE_WALK_IN_CASH_SALE_DISCOUNT_RATE * 100)}% off garment lines)` : "",
    logoSetup ? `Logo set-up $${INSTORE_WALK_IN_LOGO_SETUP_FEE_AUD.toFixed(2)}` : "",
    orderNotes,
  ]
    .filter(Boolean)
    .join("\n");

  const baseOrderNumber = nextInstoreOrderBasePrefix();
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: listErr } = await supabase
    .from("store_orders")
    .select("order_number")
    .ilike("order_number", `${baseOrderNumber}\\_%`)
    .limit(200);

  if (listErr) {
    redirect(`/instore_order?error=${encodeURIComponent(listErr.message)}`);
  }

  const re = new RegExp(`^${escapeRegExp(baseOrderNumber)}_([0-9]+)$`);
  let maxSuffix = 0;
  for (const row of existing ?? []) {
    const m = (row.order_number ?? "").match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxSuffix) maxSuffix = n;
  }
  const orderNumber = `${baseOrderNumber}_${maxSuffix + 1}`;

  const { data: orderRow, error: insErr } = await supabase
    .from("store_orders")
    .insert({
      order_number: orderNumber,
      status: "processing",
      customer_email: customerEmail,
      customer_name: customerName,
      delivery_address: deliveryAddress,
      delivery_fee_cents: 0,
      subtotal_cents: subtotalCents,
      total_cents: totalCents,
      currency: "AUD",
      carrier: pickup ? "Pick up" : "Australia Post",
      xero_sync_status: "skipped",
      xero_sync_error: "Instore walk-in — excluded from Xero",
    })
    .select("id")
    .single();

  if (insErr || !orderRow?.id) {
    const msg = insErr?.message ?? "Could not save order.";
    redirect(`/instore_order?error=${encodeURIComponent(msg)}`);
  }

  const orderId = orderRow.id as string;
  const itemRows = lines.map((line, idx) => {
    const lineNotes = [line.notes, headerNotes && idx === 0 ? headerNotes : ""].filter(Boolean).join("\n") || null;
    return {
      order_id: orderId,
      product_id: "",
      product_name: line.description,
      quantity: line.quantity,
      unit_price_cents: line.unitPriceCents,
      line_total_cents: line.unitPriceCents * line.quantity,
      service_type: line.serviceType || "Instore service",
      color: line.color || null,
      size: line.size || null,
      placements: line.location ? [line.location] : parsePlacementsJsonValue("[]"),
      notes: lineNotes,
      sort_order: idx,
    };
  });

  if (logoSetup) {
    itemRows.push({
      order_id: orderId,
      product_id: "",
      product_name: "Logo set-up (first time)",
      quantity: 1,
      unit_price_cents: logoSetupCents,
      line_total_cents: logoSetupCents,
      service_type: "Instore service",
      color: null,
      size: null,
      placements: parsePlacementsJsonValue("[]"),
      notes: null,
      sort_order: itemRows.length,
    });
  }

  const { error: itemsErr } = await supabase.from("store_order_items").insert(itemRows);
  if (itemsErr) {
    await supabase.from("store_orders").delete().eq("id", orderId);
    redirect(`/instore_order?error=${encodeURIComponent(itemsErr.message)}`);
  }

  revalidatePath("/admin/instore-orders");
  revalidatePath("/admin/online-orders");
  redirect(`/instore_order?created=${encodeURIComponent(orderNumber)}`);
}

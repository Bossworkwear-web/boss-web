"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  calculateDeliveryFee,
  distanceKmFromCompanyBase,
  extractAustralianPostcodeFromAddress,
} from "@/lib/customer-delivery-estimate";
import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";
import { sendStoreOrderConfirmationEmail } from "@/lib/store-order-email";
import { allocateNextBossStoreOrderNumber } from "@/lib/boss-customer-order-id";
import { getPerthYmd } from "@/lib/perth-calendar";
import { insertSupplierOrderLinesFromStoreCheckout } from "@/lib/supplier-order-lines-from-store-order";
import { formatMoneyFromCents, siteBaseUrl } from "@/lib/store-order-utils";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import { createSupabaseAdminClient } from "@/lib/supabase";

const CHECKOUT_REFERENCE_BUCKET = "production-order-assets";
const MAX_CHECKOUT_REF_IMAGE_BYTES = 12 * 1024 * 1024;
const CHECKOUT_REF_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function dollarsToCents(d: number): number {
  return Math.round(d * 100);
}

function estimatedWeightKgFromLines(lines: StoreOrderCartLine[]): number {
  const w = lines.reduce((sum, line) => sum + line.quantity * 0.35, 0);
  return Number(w.toFixed(2));
}

function sanitizeStorageSegment(s: string, max: number): string {
  const t = s.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (t || "file").slice(0, max);
}

function extFromFileName(name: string): string {
  const lower = (name || "").toLowerCase();
  const m = lower.match(/(\.[a-z0-9]{1,8})$/);
  return m ? m[1]! : "";
}

function isAllowedCheckoutReferenceImage(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (CHECKOUT_REF_IMAGE_TYPES.has(mime)) {
    return true;
  }
  if (mime) {
    return false;
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "gif" || ext === "webp";
}

function contentTypeForCheckoutRef(file: File): string {
  const mime = (file.type || "").toLowerCase();
  if (CHECKOUT_REF_IMAGE_TYPES.has(mime)) {
    return mime;
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

/** Only persist URLs that point at our public storage (defense in depth vs tampered localStorage). */
function sanitizeReferenceImageUrlsFromClient(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    return [];
  }
  const prefix = `${base}/storage/v1/object/public/`;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim();
    if (t.startsWith(prefix) && t.length < 2048 && !out.includes(t)) {
      out.push(t);
    }
  }
  return out;
}

function mergeNotesWithReferenceImageUrls(
  notes: string | null | undefined,
  urls: string[],
): string | null {
  const safe = urls.filter(Boolean);
  const base = (notes ?? "").trim();
  if (safe.length === 0) {
    return base.length > 0 ? base : null;
  }
  const block = safe.join("\n");
  const merged = base ? `${base}\n\n${block}` : block;
  const max = 12000;
  return merged.length > max ? merged.slice(0, max) : merged;
}

export type UploadStoreCheckoutReferenceImagesResult =
  | { ok: true; urls: string[] }
  | { ok: false; error: string };

/**
 * Upload customer reference images before add-to-cart (same bucket as production assets).
 * Requires signed-in customer cookie (same as checkout).
 */
export async function uploadStoreCheckoutReferenceImages(
  formData: FormData,
): Promise<UploadStoreCheckoutReferenceImagesResult> {
  const cookieStore = await cookies();
  const customerEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  if (!customerEmail) {
    return { ok: false, error: "Sign in to attach logo files (complete customer details first)." };
  }

  const files = formData
    .getAll("files")
    .filter((f): f is File => typeof File !== "undefined" && f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { ok: false, error: "No files to upload." };
  }
  if (files.length > 12) {
    return { ok: false, error: "Too many files (maximum 12 per add-to-cart)." };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Upload is temporarily unavailable." };
  }

  const batchId = randomUUID();
  const urls: string[] = [];

  for (const file of files) {
    if (file.size > MAX_CHECKOUT_REF_IMAGE_BYTES) {
      return {
        ok: false,
        error: `File too large (max ${MAX_CHECKOUT_REF_IMAGE_BYTES / (1024 * 1024)}MB): ${file.name}`,
      };
    }
    if (!isAllowedCheckoutReferenceImage(file)) {
      return { ok: false, error: `Unsupported file type for ${file.name}. Use JPEG, PNG, GIF, or WebP.` };
    }

    const baseName = sanitizeStorageSegment((file.name || "image").replace(/\.[^.]+$/, ""), 80);
    const ext = extFromFileName(file.name) || ".jpg";
    const path = `checkout-ref/${batchId}/${randomUUID()}_${baseName}${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());
    const contentType = contentTypeForCheckoutRef(file);

    const { error: upErr } = await supabase.storage.from(CHECKOUT_REFERENCE_BUCKET).upload(path, buf, {
      contentType,
      upsert: false,
      cacheControl: "3600",
    });

    if (upErr) {
      return { ok: false, error: upErr.message };
    }

    urls.push(publicStorageObjectUrl(CHECKOUT_REFERENCE_BUCKET, path));
  }

  return { ok: true, urls };
}

export type PlaceStoreOrderResult =
  | { ok: true; orderNumber: string; trackingToken: string; trackUrl: string }
  | { ok: false; error: string };

export async function placeStoreOrder(items: StoreOrderCartLine[]): Promise<PlaceStoreOrderResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }
  if (items.length > 80) {
    return { ok: false, error: "Too many lines in one order." };
  }

  const cookieStore = await cookies();
  const customerEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  const customerName = (cookieStore.get("customer_name")?.value ?? "").trim();
  const deliveryAddress = (cookieStore.get("customer_delivery_address")?.value ?? "").trim();

  if (!customerEmail || !customerName) {
    return { ok: false, error: "Please sign in and complete your details before paying." };
  }
  if (!deliveryAddress) {
    return { ok: false, error: "Please add a delivery address in your account details." };
  }

  for (const line of items) {
    if (
      !line.productName?.trim() ||
      !Number.isFinite(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 999 ||
      !Number.isFinite(line.unitPrice) ||
      !Number.isFinite(line.totalPrice)
    ) {
      return { ok: false, error: "Invalid cart line." };
    }
  }

  const postcode = extractAustralianPostcodeFromAddress(deliveryAddress);
  const weightKg = estimatedWeightKgFromLines(items);
  const distanceKm = distanceKmFromCompanyBase(postcode);
  const deliveryFeeDollars = calculateDeliveryFee(distanceKm, weightKg);
  const subtotalDollars = items.reduce((s, line) => s + line.totalPrice, 0);
  if (!Number.isFinite(subtotalDollars) || subtotalDollars < 0) {
    return { ok: false, error: "Invalid order total." };
  }
  const totalDollars = subtotalDollars + deliveryFeeDollars;

  const subtotalCents = dollarsToCents(subtotalDollars);
  const deliveryFeeCents = dollarsToCents(deliveryFeeDollars);
  const totalCents = dollarsToCents(totalDollars);

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Orders are temporarily unavailable (database not configured)." };
  }

  const insertPayload = {
    customer_email: customerEmail,
    customer_name: customerName,
    delivery_address: deliveryAddress,
    delivery_fee_cents: deliveryFeeCents,
    subtotal_cents: subtotalCents,
    total_cents: totalCents,
    currency: "AUD",
    carrier: "Australia Post",
    status: "paid",
  };

  let orderRow: { id: string; tracking_token: string } | null = null;
  let orderNumber = "";

  for (let attempt = 0; attempt < 8; attempt++) {
    const alloc = await allocateNextBossStoreOrderNumber(supabase);
    if (!alloc.ok) {
      return { ok: false, error: alloc.error };
    }
    orderNumber = alloc.orderNumber;

    const { data, error: orderErr } = await supabase
      .from("store_orders")
      .insert({
        ...insertPayload,
        order_number: orderNumber,
      })
      .select("id, tracking_token")
      .single();

    if (data && !orderErr) {
      orderRow = data;
      break;
    }

    const msg = orderErr?.message ?? "";
    const dup =
      orderErr?.code === "23505" || msg.toLowerCase().includes("unique") || msg.includes("duplicate key");
    if (dup) {
      continue;
    }

    if (msg.includes("store_orders") && msg.includes("schema cache")) {
      return {
        ok: false,
        error:
          "Order database is not set up. Open supabase/migrations/20260426_store_orders.sql in the repo, copy its full SQL into Supabase → SQL Editor (not the file path), Run, then try again.",
      };
    }
    return { ok: false, error: msg || "Could not save order." };
  }

  if (!orderRow) {
    return { ok: false, error: "Could not assign a unique order number. Please try again." };
  }

  const orderId = orderRow.id;
  const trackingToken = orderRow.tracking_token;

  const normalizedItems: StoreOrderCartLine[] = items.map((line) => {
    const refUrls = sanitizeReferenceImageUrlsFromClient(line.referenceImageUrls);
    const mergedNotes = mergeNotesWithReferenceImageUrls(line.notes, refUrls);
    return {
      ...line,
      notes: mergedNotes ?? undefined,
    };
  });

  const itemRows = normalizedItems.map((line, idx) => ({
    order_id: orderId,
    product_id: line.productId ?? "",
    product_name: line.productName.trim(),
    quantity: Math.floor(line.quantity),
    unit_price_cents: dollarsToCents(line.unitPrice),
    line_total_cents: dollarsToCents(line.totalPrice),
    service_type: line.serviceType || null,
    color: line.color || null,
    size: line.size || null,
    placements: line.placements ?? [],
    notes: line.notes?.trim() || null,
    sort_order: idx,
  }));

  const { error: itemsErr } = await supabase.from("store_order_items").insert(itemRows);
  if (itemsErr) {
    await supabase.from("store_orders").delete().eq("id", orderId);
    const imsg = itemsErr.message;
    if (imsg.includes("store_order_items") && imsg.includes("schema cache")) {
      return {
        ok: false,
        error:
          "Order database is not set up. Open supabase/migrations/20260426_store_orders.sql in the repo, copy its full SQL into Supabase → SQL Editor (not the file path), Run, then try again.",
      };
    }
    return { ok: false, error: imsg };
  }

  const { ymd: supplierListDate } = getPerthYmd(new Date());
  await insertSupplierOrderLinesFromStoreCheckout(supabase, orderNumber, supplierListDate, normalizedItems);
  revalidatePath("/admin/supplier-orders");
  revalidatePath("/admin/store-orders");
  revalidatePath("/admin/reports");

  const totalFormatted = formatMoneyFromCents(totalCents, "AUD");
  void sendStoreOrderConfirmationEmail({
    to: customerEmail,
    customerName,
    orderNumber,
    trackingToken,
    totalFormatted,
  });

  const trackUrl = `${siteBaseUrl()}/orders/track/${trackingToken}`;
  return { ok: true, orderNumber, trackingToken, trackUrl };
}

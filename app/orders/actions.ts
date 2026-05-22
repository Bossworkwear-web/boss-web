"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { extractAustralianPostcodeFromAddress } from "@/lib/customer-delivery-estimate";
import { computeStorefrontCheckoutFees } from "@/lib/storefront-cart-checkout-fees";
import { hasPriorEmbroideryOrderForCustomerEmail } from "@/lib/storefront-prior-embroidery-order";
import { totalEstimatedShippingWeightKg } from "@/lib/delivery-shipping-weight";
import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";
import { storefrontVolumeAdjustedCartLines } from "@/lib/storefront-volume-discount";
import { sendStoreOrderConfirmationEmail } from "@/lib/store-order-email";
import { allocateNextBossStoreOrderNumber } from "@/lib/boss-customer-order-id";
import { getPerthYmd } from "@/lib/perth-calendar";
import { insertSupplierOrderLinesFromStoreCheckout } from "@/lib/supplier-order-lines-from-store-order";
import { ensureClickUpSheetListForSupplierListDate } from "@/lib/supplier-sheet-click-up-bootstrap";
import { formatMoneyFromCents, siteBaseUrl } from "@/lib/store-order-utils";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import {
  recordPromotionRedemption,
  validatePromotionCodeForCheckout,
} from "@/lib/promotion-codes";
import { validateSpecialDealPackageCartLines } from "@/lib/storefront-special-deal-package-cart";
import { retrievePaidCheckoutSession } from "@/lib/store-order-stripe";
import { createSupabaseAdminClient } from "@/lib/supabase";

const CHECKOUT_REFERENCE_BUCKET = "production-order-assets";
const MAX_CHECKOUT_REF_IMAGE_BYTES = 12 * 1024 * 1024;
const CHECKOUT_REF_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function dollarsToCents(d: number): number {
  return Math.round(d * 100);
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

export type PlaceStoreOrderOptions = {
  /** `store_orders.id` of the order the customer reordered from (same email); persisted for Click Up mock-up carry-over. */
  reorderedFromStoreOrderId?: string;
  /** Applied checkout promotion code (`promotion_codes.id`), re-validated server-side. */
  promotionCodeId?: string;
  /** Warehouse pick-up — no delivery fee on the order. */
  pickUp?: boolean;
  /** Stripe Checkout Session id (`cs_…`) after successful payment — verified server-side. */
  stripeCheckoutSessionId?: string;
};

function escapeCustomerEmailForIlikeExact(email: string): string {
  return email.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function resolveReorderedFromStoreOrderIdForInsert(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  customerEmail: string,
  candidate: string | undefined,
): Promise<string | null> {
  const raw = (candidate ?? "").trim();
  if (!raw || !/^[0-9a-f-]{36}$/i.test(raw)) {
    return null;
  }
  const ilikeExact = escapeCustomerEmailForIlikeExact(customerEmail);
  const { data, error } = await supabase
    .from("store_orders")
    .select("id")
    .eq("id", raw)
    .ilike("customer_email", ilikeExact)
    .maybeSingle();
  if (error || !data?.id) {
    return null;
  }
  return data.id;
}

export async function placeStoreOrder(
  items: StoreOrderCartLine[],
  options?: PlaceStoreOrderOptions,
): Promise<PlaceStoreOrderResult> {
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

  const dealCheck = validateSpecialDealPackageCartLines(items);
  if (!dealCheck.ok) {
    return { ok: false, error: dealCheck.error };
  }

  const postcode = extractAustralianPostcodeFromAddress(deliveryAddress);
  const weightKg = totalEstimatedShippingWeightKg(items);
  const pricedLines = storefrontVolumeAdjustedCartLines(items);
  const subtotalDollars = pricedLines.reduce((s, line) => s + line.totalPrice, 0);
  if (!Number.isFinite(subtotalDollars) || subtotalDollars < 0) {
    return { ok: false, error: "Invalid order total." };
  }
  const itemsPricedForOrder: StoreOrderCartLine[] = items.map((line, idx) => ({
    ...line,
    unitPrice: pricedLines[idx]!.unitPrice,
    totalPrice: pricedLines[idx]!.totalPrice,
  }));

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Orders are temporarily unavailable (database not configured)." };
  }

  const hasPriorEmbroidery = await hasPriorEmbroideryOrderForCustomerEmail(supabase, customerEmail);
  const fees = computeStorefrontCheckoutFees({
    subtotalAud: subtotalDollars,
    items: itemsPricedForOrder,
    deliveryPostcode: postcode,
    estimatedWeightKg: weightKg,
    isCustomerSignedIn: true,
    hasPriorEmbroideryOrder: hasPriorEmbroidery,
    pickUp: options?.pickUp === true,
  });
  const deliveryFeeDollars = fees.deliveryFeeAud;
  let promotionDiscountDollars = 0;
  let promotionCodeId: string | null = null;

  const promoIdCandidate = (options?.promotionCodeId ?? "").trim();
  if (promoIdCandidate) {
    const { data: promoRow } = await supabase
      .from("promotion_codes")
      .select("code")
      .eq("id", promoIdCandidate)
      .maybeSingle();

    if (!promoRow?.code) {
      return { ok: false, error: "Discount code is no longer valid." };
    }

    const promoCheck = await validatePromotionCodeForCheckout(supabase, {
      codeInput: promoRow.code,
      customerEmail,
      productSubtotalAud: subtotalDollars,
    });
    if (!promoCheck.ok) {
      return { ok: false, error: promoCheck.error };
    }
    if (promoCheck.promotionCodeId !== promoIdCandidate) {
      return { ok: false, error: "Discount code is no longer valid." };
    }
    promotionDiscountDollars = promoCheck.discountAud;
    promotionCodeId = promoCheck.promotionCodeId;
  }

  const totalDollars = Math.max(0, fees.totalAud - promotionDiscountDollars);

  const subtotalCents = dollarsToCents(subtotalDollars);
  const deliveryFeeCents = dollarsToCents(deliveryFeeDollars);
  const promotionDiscountCents = dollarsToCents(promotionDiscountDollars);
  const totalCents = dollarsToCents(totalDollars);

  const stripeSessionId = (options?.stripeCheckoutSessionId ?? "").trim();
  let stripePaymentIntentId: string | null = null;
  if (stripeSessionId) {
    const { data: existingPaid } = await supabase
      .from("store_orders")
      .select("id, order_number")
      .eq("stripe_checkout_session_id", stripeSessionId)
      .maybeSingle();
    if (existingPaid?.id) {
      return {
        ok: false,
        error: `This payment is already recorded as order ${existingPaid.order_number ?? existingPaid.id}.`,
      };
    }

    const sessionRes = await retrievePaidCheckoutSession(stripeSessionId);
    if (!sessionRes.ok) {
      return { ok: false, error: sessionRes.error };
    }
    if (sessionRes.info.amountTotalCents > 0 && sessionRes.info.amountTotalCents !== totalCents) {
      return { ok: false, error: "Payment amount does not match order total. Please contact support." };
    }
    stripePaymentIntentId = sessionRes.info.paymentIntentId;
  }

  const insertPayload = {
    customer_email: customerEmail,
    customer_name: customerName,
    delivery_address: deliveryAddress,
    delivery_fee_cents: deliveryFeeCents,
    subtotal_cents: subtotalCents,
    total_cents: totalCents,
    promotion_discount_cents: promotionDiscountCents,
    ...(promotionCodeId ? { promotion_code_id: promotionCodeId } : {}),
    currency: "AUD",
    carrier: "Australia Post",
    status: "paid",
    ...(stripeSessionId
      ? {
          stripe_checkout_session_id: stripeSessionId,
          ...(stripePaymentIntentId ? { stripe_payment_intent_id: stripePaymentIntentId } : {}),
        }
      : {}),
  };

  let orderRow: { id: string; tracking_token: string } | null = null;
  let orderNumber = "";

  const reorderedFromResolved = await resolveReorderedFromStoreOrderIdForInsert(
    supabase,
    customerEmail,
    options?.reorderedFromStoreOrderId,
  );

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
        ...(reorderedFromResolved ? { reordered_from_store_order_id: reorderedFromResolved } : {}),
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

  const normalizedItems: StoreOrderCartLine[] = itemsPricedForOrder.map((line) => {
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

  const { data: insertedItems, error: itemsErr } = await supabase.from("store_order_items").insert(itemRows).select("id");
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

  if (promotionCodeId && promotionDiscountCents > 0) {
    const redemption = await recordPromotionRedemption(supabase, {
      promotionCodeId,
      customerEmail,
      discountCents: promotionDiscountCents,
      storeOrderId: orderId,
    });
    if (!redemption.ok) {
      await supabase.from("store_order_items").delete().eq("order_id", orderId);
      await supabase.from("store_orders").delete().eq("id", orderId);
      return { ok: false, error: redemption.error };
    }
  }

  const insertedIds = (insertedItems ?? []).map((r) => String((r as { id?: string }).id ?? "").trim());
  const storeOrderItemIds =
    insertedIds.length === normalizedItems.length && insertedIds.every((id) => /^[0-9a-f-]{36}$/i.test(id))
      ? insertedIds
      : null;

  const { ymd: supplierListDate } = getPerthYmd(new Date());
  await insertSupplierOrderLinesFromStoreCheckout(
    supabase,
    orderNumber,
    supplierListDate,
    normalizedItems,
    storeOrderItemIds,
  );
  const clickUpRes = await ensureClickUpSheetListForSupplierListDate(supabase, supplierListDate);
  if (!clickUpRes.ok) {
    console.error("[placeStoreOrder] click_up_sheet_list:", clickUpRes.error);
  }
  revalidatePath("/admin/supplier-orders");
  revalidatePath("/admin/store-orders");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/work-process");
  revalidatePath("/admin/click-up-sheet");

  const totalFormatted = formatMoneyFromCents(totalCents, "AUD");
  let xeroInvoiceNumber: string | undefined;
  try {
    const { syncStoreOrderToXero } = await import("@/lib/xero/sync-store-order");
    const xeroRes = await syncStoreOrderToXero(orderId);
    if (xeroRes.ok) {
      xeroInvoiceNumber = xeroRes.invoiceNumber;
    } else if (!xeroRes.skipped) {
      console.error("[placeStoreOrder] xero sync:", xeroRes.error);
    }
  } catch (e) {
    console.error("[placeStoreOrder] xero sync:", e);
  }

  let taxInvoicePdf: { filename: string; base64: string } | undefined;
  if (xeroInvoiceNumber) {
    try {
      const { buildStoreTaxInvoicePdfForOrderId } = await import("@/lib/store-tax-invoice-for-order");
      const pdfRes = await buildStoreTaxInvoicePdfForOrderId(orderId);
      if (pdfRes.ok) {
        taxInvoicePdf = {
          filename: pdfRes.filename,
          base64: pdfRes.buffer.toString("base64"),
        };
      } else {
        console.error("[placeStoreOrder] tax invoice PDF:", pdfRes.error);
      }
    } catch (e) {
      console.error("[placeStoreOrder] tax invoice PDF:", e);
    }
  }

  const emailRes = await sendStoreOrderConfirmationEmail({
    to: customerEmail,
    customerName,
    orderNumber,
    trackingToken,
    totalFormatted,
    xeroInvoiceNumber,
    taxInvoicePdf,
  });
  if (!emailRes.ok) {
    console.error("[placeStoreOrder] confirmation email:", emailRes.error);
  }

  const trackUrl = `${siteBaseUrl()}/orders/track/${trackingToken}`;
  return { ok: true, orderNumber, trackingToken, trackUrl };
}

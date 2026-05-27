"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";
import { placeStoreOrderCore } from "@/lib/place-store-order-core";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import { createSupabaseAdminClient } from "@/lib/supabase";

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
  /** Apply store credit at checkout (default true). */
  applyStoreCredit?: boolean;
  /** Credit-only checkout — amount locked server-side from /api/stripe/checkout. */
  storeCreditAppliedCents?: number;
};

const CHECKOUT_REFERENCE_BUCKET = "production-order-assets";
const MAX_CHECKOUT_REF_IMAGE_BYTES = 12 * 1024 * 1024;
const CHECKOUT_REF_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

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

export async function placeStoreOrder(
  items: StoreOrderCartLine[],
  options?: PlaceStoreOrderOptions,
): Promise<PlaceStoreOrderResult> {
  const cookieStore = await cookies();
  const customerEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  const customerName = (cookieStore.get("customer_name")?.value ?? "").trim();
  const deliveryAddress = (cookieStore.get("customer_delivery_address")?.value ?? "").trim();

  const stripeSessionId = (options?.stripeCheckoutSessionId ?? "").trim();
  const coreResult = await placeStoreOrderCore({
    customerEmail,
    customerName,
    deliveryAddress,
    items,
    options: {
      ...options,
      ...(stripeSessionId ? { allowExistingStripeSession: true } : {}),
    },
  });

  if (!coreResult.ok) {
    return coreResult;
  }

  const { orderId: _orderId, ...result } = coreResult;
  return result;
}

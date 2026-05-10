"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import { createSupabaseAdminClient } from "@/lib/supabase";

const DISPATCH_CARRIER_LABEL_BUCKET = "dispatch-carrier-labels";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_LABELS_PER_ROW = 12;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function sanitizeStorageSegment(s: string, max: number): string {
  const t = s.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (t || "label").slice(0, max);
}

function extFromFileName(name: string): string {
  const lower = (name || "").toLowerCase();
  const m = lower.match(/(\.[a-z0-9]{1,8})$/);
  return m ? m[1]! : "";
}

function objectPathFromPublicUrl(publicUrl: string): string | null {
  try {
    const u = new URL(publicUrl);
    const needle = `/object/public/${DISPATCH_CARRIER_LABEL_BUCKET}/`;
    const idx = u.pathname.indexOf(needle);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + needle.length));
  } catch {
    return null;
  }
}

type DispatchCarrierLabelActionResult =
  | { ok: true; carrierLabelImageUrls: string[] }
  | { ok: false; error: string };

/** Upload one carrier label image/PDF (AusPost QR, barcode sheet, etc.) for a dispatch queue row. */
export async function uploadDispatchCarrierLabel(formData: FormData): Promise<DispatchCarrierLabelActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const queueId = (formData.get("queue_id") ?? "").toString().trim();
  if (!UUID_RE.test(queueId)) {
    return { ok: false, error: "Invalid queue id." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `File too large (max ${Math.round(MAX_BYTES / (1024 * 1024))}MB).` };
  }

  const mime = (file.type ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (!ALLOWED_TYPES.has(mime)) {
    return { ok: false, error: "Use JPEG, PNG, WebP, GIF, or PDF." };
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: row, error: selErr } = await supabase
      .from("click_up_dispatch_queue")
      .select("id, carrier_label_image_urls")
      .eq("id", queueId)
      .maybeSingle();

    if (selErr) {
      return { ok: false, error: selErr.message };
    }
    if (!row?.id) {
      return { ok: false, error: "Dispatch queue row not found." };
    }

    const existing = Array.isArray(row.carrier_label_image_urls)
      ? (row.carrier_label_image_urls as string[]).filter((u) => typeof u === "string" && u.trim().length > 0)
      : [];

    if (existing.length >= MAX_LABELS_PER_ROW) {
      return { ok: false, error: `Maximum ${MAX_LABELS_PER_ROW} labels per order.` };
    }

    const queueSeg = sanitizeStorageSegment(queueId, 40);
    const baseName = sanitizeStorageSegment((file.name || "label").replace(/\.[^.]+$/, ""), 80);
    const ext = extFromFileName(file.name) || (mime === "application/pdf" ? ".pdf" : ".jpg");
    const storagePath = `${queueSeg}/${randomUUID()}_${baseName}${ext}`;

    const buf = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage.from(DISPATCH_CARRIER_LABEL_BUCKET).upload(storagePath, buf, {
      contentType: mime || undefined,
      upsert: false,
      cacheControl: "3600",
    });

    if (upErr) {
      return { ok: false, error: upErr.message };
    }

    const publicUrl = publicStorageObjectUrl(DISPATCH_CARRIER_LABEL_BUCKET, storagePath);
    if (!publicUrl) {
      return { ok: false, error: "Storage URL could not be built (check NEXT_PUBLIC_SUPABASE_URL)." };
    }

    const nextUrls = [...existing, publicUrl];

    const { error: upRowErr } = await supabase
      .from("click_up_dispatch_queue")
      .update({ carrier_label_image_urls: nextUrls })
      .eq("id", queueId);

    if (upRowErr) {
      return { ok: false, error: upRowErr.message };
    }

    revalidatePath("/admin/dispatch");
    return { ok: true, carrierLabelImageUrls: nextUrls };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { ok: false, error: msg };
  }
}

/** Remove one uploaded label URL from the queue row and delete the storage object when possible. */
export async function removeDispatchCarrierLabel(formData: FormData): Promise<DispatchCarrierLabelActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const queueId = (formData.get("queue_id") ?? "").toString().trim();
  const removeUrl = (formData.get("remove_url") ?? "").toString().trim();

  if (!UUID_RE.test(queueId)) {
    return { ok: false, error: "Invalid queue id." };
  }
  if (!removeUrl) {
    return { ok: false, error: "Missing URL." };
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: row, error: selErr } = await supabase
      .from("click_up_dispatch_queue")
      .select("id, carrier_label_image_urls")
      .eq("id", queueId)
      .maybeSingle();

    if (selErr) {
      return { ok: false, error: selErr.message };
    }
    if (!row?.id) {
      return { ok: false, error: "Dispatch queue row not found." };
    }

    const existing = Array.isArray(row.carrier_label_image_urls)
      ? (row.carrier_label_image_urls as string[]).filter((u) => typeof u === "string" && u.trim().length > 0)
      : [];

    const nextUrls = existing.filter((u) => u !== removeUrl);
    if (nextUrls.length === existing.length) {
      return { ok: false, error: "That label was not attached to this row." };
    }

    const path = objectPathFromPublicUrl(removeUrl);
    if (path) {
      await supabase.storage.from(DISPATCH_CARRIER_LABEL_BUCKET).remove([path]);
    }

    const { error: upErr } = await supabase
      .from("click_up_dispatch_queue")
      .update({ carrier_label_image_urls: nextUrls })
      .eq("id", queueId);

    if (upErr) {
      return { ok: false, error: upErr.message };
    }

    revalidatePath("/admin/dispatch");
    return { ok: true, carrierLabelImageUrls: nextUrls };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Remove failed";
    return { ok: false, error: msg };
  }
}

import { randomUUID } from "node:crypto";

import { assertAdminSession } from "@/lib/admin-auth";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import { createSupabaseAdminClient } from "@/lib/supabase";

const BUCKET = "production-order-assets";
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const INSTORE_IMAGE_PREFIX = "instore-order/";

function extFromName(name: string): string {
  const lower = (name || "").toLowerCase();
  const m = lower.match(/(\.[a-z0-9]{1,8})$/);
  return m ? m[1]! : "";
}

function isAllowedImage(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (ALLOWED_TYPES.has(mime)) {
    return true;
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "gif" || ext === "webp";
}

export async function POST(req: Request) {
  try {
    await assertAdminSession();
  } catch {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return Response.json({ ok: false, error: "Choose an image file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ ok: false, error: "Image is too large (max 12 MB)." }, { status: 400 });
  }
  if (!isAllowedImage(file)) {
    return Response.json({ ok: false, error: "Only JPEG, PNG, GIF, or WebP images are allowed." }, { status: 400 });
  }

  const ext = extFromName(file.name) || ".jpg";
  const storagePath = `${INSTORE_IMAGE_PREFIX}drafts/${randomUUID()}${ext}`;

  try {
    const supabase = createSupabaseAdminClient();
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      upsert: false,
      contentType: file.type || "image/jpeg",
      cacheControl: "3600",
    });
    if (upErr) {
      return Response.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    const url = publicStorageObjectUrl(BUCKET, storagePath);
    if (!url) {
      return Response.json({ ok: false, error: "Could not build image URL." }, { status: 500 });
    }

    return Response.json({ ok: true, url, storagePath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await assertAdminSession();
  } catch {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { storagePath?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const storagePath = String(body.storagePath ?? "").trim();
  if (!storagePath.startsWith(INSTORE_IMAGE_PREFIX)) {
    return Response.json({ ok: false, error: "Invalid path." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

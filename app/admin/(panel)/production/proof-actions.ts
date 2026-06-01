"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { assertAdminSessionForPathSegment } from "@/lib/admin-auth";
import { sendOrderProofEmail } from "@/lib/order-proof-email";
import {
  normalizeProofStatus,
  parseProofImageUrls,
  proofApproveUrl,
  type OrderProofRecord,
} from "@/lib/order-proof";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import {
  listClickUpMockupsByStoreOrderNumber,
  type ClickUpSheetImageDto,
} from "@/app/admin/(panel)/click-up-sheet/actions";

/** Reuse the Click-up sheet bucket; proof logo uploads live under a dedicated prefix (no DB row needed). */
const PROOF_LOGO_BUCKET = "click-up-sheet-images";
const PROOF_LOGO_MAX_BYTES = 15 * 1024 * 1024;
const PROOF_LOGO_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export type ListOrderProofsResult =
  | { ok: true; proofs: OrderProofRecord[] }
  | { ok: false; error: string };

function mapProofRow(row: {
  id: string;
  store_order_id: string;
  order_number: string;
  round: number;
  status: string;
  token: string;
  image_urls: unknown;
  note: string | null;
  sent_to: string;
  sent_at: string;
  decided_at: string | null;
  customer_comment: string | null;
}): OrderProofRecord {
  return {
    id: row.id,
    storeOrderId: row.store_order_id,
    orderNumber: row.order_number,
    round: row.round,
    status: normalizeProofStatus(row.status),
    token: row.token,
    imageUrls: parseProofImageUrls(row.image_urls),
    note: row.note,
    sentTo: row.sent_to,
    sentAt: row.sent_at,
    decidedAt: row.decided_at,
    customerComment: row.customer_comment,
  };
}

export async function listOrderProofs(storeOrderId: string): Promise<ListOrderProofsResult> {
  try {
    await assertAdminSessionForPathSegment("/admin/production");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = (storeOrderId ?? "").trim();
  if (!id) {
    return { ok: true, proofs: [] };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_proofs")
      .select(
        "id, store_order_id, order_number, round, status, token, image_urls, note, sent_to, sent_at, decided_at, customer_comment",
      )
      .eq("store_order_id", id)
      .order("round", { ascending: false });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, proofs: (data ?? []).map(mapProofRow) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

export type ProofContextByOrderNumberResult =
  | {
      ok: true;
      storeOrderId: string;
      orderNumber: string;
      mockupImages: ClickUpSheetImageDto[];
      proofs: OrderProofRecord[];
    }
  | { ok: false; error: string };

/**
 * Resolve everything the proof panel needs from a Customer Order ID (order number): the store order UUID,
 * its mock-up images, and existing proof rounds. Lets the Click-up sheet send proofs for whichever order is
 * loaded, without the page knowing the UUID up front.
 */
export async function loadProofContextByOrderNumber(
  orderNumber: string,
): Promise<ProofContextByOrderNumberResult> {
  try {
    await assertAdminSessionForPathSegment("/admin/click-up-sheet");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const num = (orderNumber ?? "").trim();
  if (!num) {
    return { ok: false, error: "No order id." };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("id, order_number")
      .ilike("order_number", num)
      .maybeSingle();
    if (error) {
      return { ok: false, error: error.message };
    }
    if (!order) {
      return { ok: false, error: `No order found for "${num}".` };
    }

    const storeOrderId = String(order.id);
    const orderNumberResolved = String(order.order_number ?? num);

    const { data: proofRows, error: proofErr } = await supabase
      .from("order_proofs")
      .select(
        "id, store_order_id, order_number, round, status, token, image_urls, note, sent_to, sent_at, decided_at, customer_comment",
      )
      .eq("store_order_id", storeOrderId)
      .order("round", { ascending: false });
    if (proofErr) {
      return { ok: false, error: proofErr.message };
    }

    const mockupsRes = await listClickUpMockupsByStoreOrderNumber(orderNumberResolved).catch(() => ({
      ok: false as const,
      error: "Mockups load failed",
    }));
    const mockupImages = mockupsRes.ok ? mockupsRes.images : [];

    return {
      ok: true,
      storeOrderId,
      orderNumber: orderNumberResolved,
      mockupImages,
      proofs: (proofRows ?? []).map(mapProofRow),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Load failed" };
  }
}

export type UploadProofLogoResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Upload an externally-produced embroidery/print logo image to send with a proof. Returns a public URL the
 * proof panel prepends ahead of the mock-ups, so the customer sees the logo artwork first, then the mock-ups.
 */
export async function uploadProofLogoImage(formData: FormData): Promise<UploadProofLogoResult> {
  try {
    await assertAdminSessionForPathSegment("/admin/click-up-sheet");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a logo image file." };
  }

  let ext = PROOF_LOGO_EXT_BY_MIME[file.type.toLowerCase()];
  if (!ext) {
    const m = file.name.toLowerCase().match(/\.(jpe?g|png|gif|webp)$/);
    if (m) ext = m[1] === "jpeg" ? "jpg" : m[1];
  }
  if (!ext) {
    return { ok: false, error: "Use a JPEG, PNG, GIF, or WebP image for the logo." };
  }

  if (file.size > PROOF_LOGO_MAX_BYTES) {
    return { ok: false, error: `Logo image must be at most ${Math.round(PROOF_LOGO_MAX_BYTES / (1024 * 1024))} MB.` };
  }

  const orderNumber = String(formData.get("order_number") ?? "").trim();
  const safeOrder = (orderNumber.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40) || "order").toLowerCase();
  const storagePath = `proof-logos/${safeOrder}/${randomBytes(8).toString("hex")}.${ext}`;
  const contentType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

  try {
    const supabase = createSupabaseAdminClient();
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage
      .from(PROOF_LOGO_BUCKET)
      .upload(storagePath, buf, { contentType, upsert: false });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, url: publicStorageObjectUrl(PROOF_LOGO_BUCKET, storagePath) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}

function proofExtFromContentTypeOrUrl(contentType: string, url: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("pdf")) return "pdf";
  const m = url.toLowerCase().match(/\.(png|jpe?g|gif|webp|pdf)(\?|$)/);
  if (m) return m[1] === "jpeg" ? "jpg" : m[1];
  return "png";
}

/**
 * Copy each proof image into a stable `order-proofs/<order>/r<round>/` path so the proof is immutable. Without
 * this, a proof references live mock-up objects by URL; when staff later delete or replace a mock-up, the
 * already-sent proof (and its history thumbnail) breaks (Supabase 400/404). Images already living under our
 * stable prefixes are kept as-is; any copy failure falls back to the original URL.
 */
async function snapshotProofImages(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orderNumber: string,
  round: number,
  urls: string[],
): Promise<string[]> {
  const safeOrder = (orderNumber.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40) || "order").toLowerCase();
  const out: string[] = [];
  let idx = 0;
  for (const url of urls) {
    idx += 1;
    if (/\/(proof-logos|order-proofs)\//.test(url)) {
      out.push(url);
      continue;
    }
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        out.push(url);
        continue;
      }
      const contentType = resp.headers.get("content-type") ?? "";
      const ext = proofExtFromContentTypeOrUrl(contentType, url);
      const buf = Buffer.from(await resp.arrayBuffer());
      const path = `order-proofs/${safeOrder}/r${round}/${idx}-${randomBytes(6).toString("hex")}.${ext}`;
      const { error } = await supabase.storage
        .from(PROOF_LOGO_BUCKET)
        .upload(path, buf, { contentType: contentType || `image/${ext}`, upsert: false });
      if (error) {
        out.push(url);
        continue;
      }
      out.push(publicStorageObjectUrl(PROOF_LOGO_BUCKET, path));
    } catch {
      out.push(url);
    }
  }
  return out;
}

export type SendOrderProofResult =
  | { ok: true; round: number }
  | { ok: false; error: string };

/** Create a new proof round, email it to the order customer with a no-login approve link. */
export async function sendOrderProofForApproval(args: {
  storeOrderId: string;
  /** Click-up mock-ups (with decorate method + MEMO), shown under "Logo Location, Colour & Size". */
  mockups: Array<{ url: string; method: string; memo: string }>;
  /** Drag-and-dropped artwork, shown under "Embroidery Preview". */
  embroideryPreviews: string[];
  note: string;
}): Promise<SendOrderProofResult> {
  try {
    await assertAdminSessionForPathSegment("/admin/production");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const storeOrderId = (args.storeOrderId ?? "").trim();
  if (!storeOrderId) {
    return { ok: false, error: "Missing order id." };
  }

  const mockupUrls = parseProofImageUrls((args.mockups ?? []).map((m) => m.url));
  const previewUrls = parseProofImageUrls(args.embroideryPreviews ?? []);
  if (mockupUrls.length === 0 && previewUrls.length === 0) {
    return { ok: false, error: "Upload a logo image or select at least one mock-up to send." };
  }

  const note = (args.note ?? "").trim();

  try {
    const supabase = createSupabaseAdminClient();

    const { data: order, error: orderErr } = await supabase
      .from("store_orders")
      .select("id, order_number, customer_email, customer_name")
      .eq("id", storeOrderId)
      .maybeSingle();
    if (orderErr) {
      return { ok: false, error: orderErr.message };
    }
    if (!order) {
      return { ok: false, error: "Order not found." };
    }

    const customerEmail = (order.customer_email ?? "").trim();
    if (!customerEmail) {
      return { ok: false, error: "This order has no customer email to send the proof to." };
    }

    // The customer's saved master logo is always included at the top of the proof when configured.
    let masterLogoUrl = "";
    {
      const { data: master } = await supabase
        .from("customer_master_company_logo")
        .select("storage_bucket, storage_path")
        .eq("customer_email", customerEmail.toLowerCase())
        .maybeSingle();
      const mBucket = String((master as { storage_bucket?: string | null })?.storage_bucket ?? "").trim();
      const mPath = String((master as { storage_path?: string | null })?.storage_path ?? "").trim();
      if (mBucket && mPath) {
        masterLogoUrl = publicStorageObjectUrl(mBucket, mPath);
      }
    }

    const { data: latest, error: latestErr } = await supabase
      .from("order_proofs")
      .select("round")
      .eq("store_order_id", storeOrderId)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) {
      return { ok: false, error: latestErr.message };
    }
    const nextRound = (latest?.round ?? 0) + 1;

    const token = randomBytes(24).toString("hex");

    // Snapshot images into a stable location so the proof never breaks if the source mock-up is later changed.
    const stableMockupUrls = await snapshotProofImages(supabase, order.order_number, nextRound, mockupUrls);
    const stablePreviewUrls = await snapshotProofImages(supabase, order.order_number, nextRound, previewUrls);

    const captionByUrl = new Map(
      (args.mockups ?? []).map((m) => [m.url, { method: m.method ?? "", memo: m.memo ?? "" }]),
    );
    const mockupItems = stableMockupUrls.map((url, i) => ({
      url,
      caption: captionByUrl.get(mockupUrls[i]) ?? { method: "", memo: "" },
    }));

    const emailResult = await sendOrderProofEmail({
      to: customerEmail,
      contactName: order.customer_name ?? "",
      orderNumber: order.order_number,
      round: nextRound,
      masterLogoUrl,
      mockups: mockupItems,
      embroideryPreviews: stablePreviewUrls,
      note: note || null,
      approveUrl: proofApproveUrl(storeOrderId, token),
    });

    if (!emailResult.ok) {
      const hint = emailResult.skipped
        ? " (Email is not configured: set RESEND_API_KEY.)"
        : "";
      return { ok: false, error: `Could not send the proof email${hint}: ${emailResult.error}` };
    }

    // Store the master logo first (when present), then mock-ups, then previews — the same order the
    // customer sees in the email and on the approval page.
    const storedImageUrls = [
      ...(masterLogoUrl ? [masterLogoUrl] : []),
      ...stableMockupUrls,
      ...stablePreviewUrls,
    ];

    const { error: insErr } = await supabase.from("order_proofs").insert({
      store_order_id: storeOrderId,
      order_number: order.order_number,
      round: nextRound,
      status: "sent",
      token,
      image_urls: storedImageUrls,
      note: note || null,
      sent_to: customerEmail,
    });
    if (insErr) {
      return { ok: false, error: `Email sent, but saving the proof record failed: ${insErr.message}` };
    }

    revalidatePath(`/admin/production/${storeOrderId}`);
    revalidatePath("/admin/click-up-sheet");
    revalidatePath("/customer");
    return { ok: true, round: nextRound };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return { ok: false, error: msg };
  }
}

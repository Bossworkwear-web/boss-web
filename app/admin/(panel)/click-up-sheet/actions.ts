"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import { formatClickUpSheetStorageError } from "@/lib/click-up-sheet-storage-errors";
import { sanitizeMockupDecorateMethodsFromClient } from "@/lib/click-up-sheet-mockup-methods";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import {
  getCustomerDetailForStoreOrderNumber,
  placementsFromDb,
  type StoreOrderCustomerMemoLine,
} from "@/lib/store-order-customer-detail";
import {
  guardCustomerOrderNumberNotInCompleteOrdersQueue,
  guardStoreOrderNotInCompleteOrdersQueue,
} from "@/lib/complete-orders-queue-mutation-block";
import { queryClickUpMockupImagesByCustomerOrderId } from "@/lib/fetch-click-up-mockups";
import { appendClickUpProductionQueueSetupHint } from "@/lib/supabase-click-up-production-queue-hint";
import { createSupabaseAdminClient } from "@/lib/supabase";

const CLICK_UP_SHEET_IMAGES_BUCKET = "click-up-sheet-images";
const MAX_CLICK_UP_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CLICK_UP_PDF_BYTES = 20 * 1024 * 1024;
const CLICK_UP_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function resolveUploadImageMime(file: File): string | null {
  const raw = (file.type || "").toLowerCase();
  if (CLICK_UP_IMAGE_TYPES.has(raw)) {
    return raw;
  }
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (name.endsWith(".png")) {
    return "image/png";
  }
  if (name.endsWith(".gif")) {
    return "image/gif";
  }
  if (name.endsWith(".webp")) {
    return "image/webp";
  }
  return null;
}

function resolveUploadPdfMime(file: File): "application/pdf" | null {
  const raw = (file.type || "").toLowerCase();
  if (raw === "application/pdf") {
    return "application/pdf";
  }
  if ((file.name || "").toLowerCase().endsWith(".pdf")) {
    return "application/pdf";
  }
  return null;
}

/** Mock-up uploads: images + PDF. Reference sheet images: images only. */
function resolveUploadMimeForClickUp(file: File, isMockup: boolean): string | null {
  const img = resolveUploadImageMime(file);
  if (img) {
    return img;
  }
  if (isMockup) {
    return resolveUploadPdfMime(file);
  }
  return null;
}

function maxBytesForMime(mime: string): number {
  return mime === "application/pdf" ? MAX_CLICK_UP_PDF_BYTES : MAX_CLICK_UP_IMAGE_BYTES;
}

export type ClickUpSupplierLineRow = {
  id: string;
  supplier: string;
  customer_order_id: string;
  product_id: string;
  colour: string;
  size: string;
  quantity: number;
  unit_price_cents: number;
  notes: string;
  ordered_date: string | null;
  received_date: string | null;
};

function parseListDateYmd(v: string): string | null {
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export type LoadSupplierLinesResult =
  | { ok: true; lines: ClickUpSupplierLineRow[] }
  | { ok: false; error: string };

export async function loadSupplierOrderLinesForClickUpSheet(
  listDateYmd: string,
  customerOrderIdFilter: string | null,
): Promise<LoadSupplierLinesResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const listDate = parseListDateYmd(listDateYmd);
  if (!listDate) {
    return { ok: true, lines: [] };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const filter = customerOrderIdFilter?.trim() ?? "";

    let q = supabase
      .from("supplier_order_lines")
      .select(
        "id, supplier, customer_order_id, product_id, colour, size, quantity, unit_price_cents, notes, ordered_date, received_date, updated_at",
      )
      .eq("list_date", listDate)
      .order("updated_at", { ascending: false });

    if (filter) {
      q = q.eq("customer_order_id", filter);
    }

    const { data, error } = await q;
    if (error) {
      return { ok: false, error: error.message };
    }

    const lines: ClickUpSupplierLineRow[] = (data ?? []).map((r) => ({
      id: r.id,
      supplier: r.supplier ?? "",
      customer_order_id: r.customer_order_id ?? "",
      product_id: r.product_id ?? "",
      colour: r.colour ?? "",
      size: r.size ?? "",
      quantity: r.quantity ?? 0,
      unit_price_cents: r.unit_price_cents ?? 0,
      notes: r.notes ?? "",
      ordered_date: r.ordered_date ?? null,
      received_date: r.received_date ?? null,
    }));

    return { ok: true, lines };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

export type LookupStoreOrderCustomerResult =
  | {
      ok: true;
      customerName: string;
      organisationName: string;
      logoLocations: string;
      checkoutMemos: StoreOrderCustomerMemoLine[];
    }
  | { ok: false; error: string };

export async function lookupCustomerByStoreOrderNumber(
  orderNumber: string,
): Promise<LookupStoreOrderCustomerResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const detail = await getCustomerDetailForStoreOrderNumber(supabase, orderNumber);
    return {
      ok: true,
      customerName: detail.customerName,
      organisationName: detail.organisationName,
      logoLocations: detail.logoLocations,
      checkoutMemos: detail.checkoutMemos,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
    return { ok: false, error: msg };
  }
}

export type ResolveProductionOrderIdResult =
  | { ok: true; productionOrderId: string }
  | { ok: false; error: string };

/** `store_orders.order_number` (Click up sheet Order ID) → Production pack route UUID. */
export async function resolveProductionOrderIdForStoreOrderNumber(
  orderNumber: string,
): Promise<ResolveProductionOrderIdResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = orderNumber.trim();
  if (!id) {
    return { ok: false, error: "Order ID is required." };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("store_orders").select("id").eq("order_number", id).maybeSingle();
    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.id) {
      return {
        ok: false,
        error: "No store order matches this Order ID. Check the number matches store_orders.order_number.",
      };
    }
    return { ok: true, productionOrderId: data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
    return { ok: false, error: msg };
  }
}

/**
 * Creates the Production pack for this store order (row in `click_up_production_queue`) and refreshes the Production
 * admin list. Call before navigating to `/admin/production/{id}`.
 */
export async function moveClickUpSheetOrderToProduction(
  orderNumber: string,
  listDateYmd: string,
): Promise<ResolveProductionOrderIdResult> {
  const resolved = await resolveProductionOrderIdForStoreOrderNumber(orderNumber);
  if (!resolved.ok) {
    return resolved;
  }

  const queueGuard = await guardStoreOrderNotInCompleteOrdersQueue(resolved.productionOrderId);
  if (!queueGuard.ok) {
    return { ok: false, error: queueGuard.error };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("click_up_production_queue").upsert(
      {
        store_order_id: resolved.productionOrderId,
        list_date: listDateYmd.trim(),
        moved_at: new Date().toISOString(),
      },
      { onConflict: "store_order_id" },
    );
    if (error) {
      return { ok: false, error: appendClickUpProductionQueueSetupHint(error.message) };
    }
    revalidatePath("/admin/production");
    revalidatePath(`/admin/production/${resolved.productionOrderId}`);
    revalidatePath("/admin/work-process");
    return resolved;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not start production pack.";
    return { ok: false, error: msg };
  }
}

function sanitizeStorageSegment(s: string, max: number): string {
  const t = s.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (t || "file").slice(0, max);
}

function extFromUploadedFile(name: string, mime: string): string {
  const lower = name.toLowerCase();
  const m = lower.match(/(\.[a-z0-9]{1,8})$/);
  if (m) {
    return m[1]!;
  }
  if (mime === "image/jpeg") {
    return ".jpg";
  }
  if (mime === "image/png") {
    return ".png";
  }
  if (mime === "image/gif") {
    return ".gif";
  }
  if (mime === "image/webp") {
    return ".webp";
  }
  if (mime === "application/pdf") {
    return ".pdf";
  }
  return ".bin";
}

function buildClickUpImageStoragePath(listDate: string, customerOrderId: string, file: File, mime: string): string {
  const orderSeg = customerOrderId.trim()
    ? sanitizeStorageSegment(customerOrderId.trim(), 80)
    : "_sheet";
  const baseName = sanitizeStorageSegment(file.name.replace(/\.[^.]+$/, ""), 60);
  const ext = extFromUploadedFile(file.name, mime);
  return `${listDate}/${orderSeg}/${randomUUID()}_${baseName}${ext}`;
}

export type ClickUpSheetImageDto = {
  id: string;
  list_date: string;
  customer_order_id: string;
  storage_path: string;
  public_url: string;
  sort_order: number;
  created_at: string;
  is_mockup: boolean;
  /** JSON array string from Add mock-up modal, e.g. `["Embroidery","DTF/HTV"]`. */
  mockup_decorate_methods: string | null;
  /** Optional note from Edit mock-up (MEMO). */
  mockup_memo: string | null;
};

export type ClickUpSheetImageFilter = "all" | "mockup" | "reference";

export async function listClickUpSheetImages(
  listDateYmd: string,
  customerOrderId: string,
  assetFilter: ClickUpSheetImageFilter = "all",
): Promise<{ ok: true; images: ClickUpSheetImageDto[] } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const listDate = parseListDateYmd(listDateYmd);
  if (!listDate) {
    return { ok: true, images: [] };
  }

  const orderId = customerOrderId.trim();

  try {
    const supabase = createSupabaseAdminClient();
    let q =
      orderId.length > 0
        ? supabase
            .from("click_up_sheet_images")
            .select(
              "id, list_date, customer_order_id, storage_path, sort_order, created_at, is_mockup, mockup_decorate_methods, mockup_memo",
            )
            .eq("list_date", listDate)
            .eq("customer_order_id", orderId)
        : supabase
            .from("click_up_sheet_images")
            .select(
              "id, list_date, customer_order_id, storage_path, sort_order, created_at, is_mockup, mockup_decorate_methods, mockup_memo",
            )
            .eq("list_date", listDate)
            .eq("customer_order_id", "");

    if (assetFilter === "mockup") {
      q = q.eq("is_mockup", true);
    } else if (assetFilter === "reference") {
      q = q.eq("is_mockup", false);
    }

    const { data, error } = await q
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return { ok: false, error: error.message };
    }

    const images: ClickUpSheetImageDto[] = (data ?? []).map((r) => ({
      id: r.id,
      list_date: r.list_date,
      customer_order_id: r.customer_order_id ?? "",
      storage_path: r.storage_path,
      public_url: publicStorageObjectUrl(CLICK_UP_SHEET_IMAGES_BUCKET, r.storage_path),
      sort_order: r.sort_order,
      created_at: r.created_at,
      is_mockup: Boolean((r as { is_mockup?: boolean }).is_mockup),
      mockup_decorate_methods: (r as { mockup_decorate_methods?: string | null }).mockup_decorate_methods ?? null,
      mockup_memo: (r as { mockup_memo?: string | null }).mockup_memo ?? null,
    }));

    return { ok: true, images };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

export type ListClickUpMockupsByOrderResult =
  | { ok: true; images: ClickUpSheetImageDto[] }
  | { ok: false; error: string };

/** All mock-up assets for a store order number (any Perth worksheet date). For warehouse workers. */
export async function listClickUpMockupsByStoreOrderNumber(
  orderNumber: string,
): Promise<ListClickUpMockupsByOrderResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = orderNumber.trim();
  if (!id) {
    return { ok: true, images: [] };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const result = await queryClickUpMockupImagesByCustomerOrderId(supabase, id);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    const images: ClickUpSheetImageDto[] = result.rows;
    return { ok: true, images };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

const PRODUCTION_ORDER_ASSETS_BUCKET = "production-order-assets";

function extractHttpUrlsFromText(s: string): string[] {
  const re = /https?:\/\/[^\s"'<>)\]]+/gi;
  const matches = s.match(re) ?? [];
  return matches.map((raw) => raw.replace(/[),.;"'\]>]+$/, ""));
}

function looksLikeCustomerProvidedAssetUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes("/storage/v1/object/public/")) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|svg|pdf)(\?|$)/i.test(url);
}

export type CustomerReferenceVisualDto = {
  key: string;
  public_url: string;
  caption: string;
};

/**
 * Logos / artwork the customer supplied: all `production_order_assets` rows for this store order (any kind),
 * plus any image/PDF URLs embedded in `store_order_items.placements` or `store_order_items.notes`.
 */
export async function listCustomerReferenceVisualsForStoreOrderNumber(
  orderNumber: string,
): Promise<{ ok: true; items: CustomerReferenceVisualDto[] } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = orderNumber.trim();
  if (!id) {
    return { ok: true, items: [] };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: so, error: soErr } = await supabase
      .from("store_orders")
      .select("id")
      .eq("order_number", id)
      .maybeSingle();

    if (soErr || !so) {
      return { ok: true, items: [] };
    }

    const orderUuid = so.id;
    const items: CustomerReferenceVisualDto[] = [];
    const seen = new Set<string>();

    const { data: assets, error: aErr } = await supabase
      .from("production_order_assets")
      .select("id, kind, label, storage_bucket, storage_path, created_at")
      .eq("order_id", orderUuid)
      .order("created_at", { ascending: false });

    if (!aErr && assets?.length) {
      for (const r of assets) {
        const row = r as {
          id: string;
          kind: string;
          label: string | null;
          storage_bucket: string | null;
          storage_path: string;
        };
        const bucket = row.storage_bucket?.trim() || PRODUCTION_ORDER_ASSETS_BUCKET;
        const url = publicStorageObjectUrl(bucket, row.storage_path);
        if (seen.has(url)) {
          continue;
        }
        seen.add(url);
        const kind = (row.kind ?? "file").trim();
        const label = (row.label ?? "").trim();
        items.push({
          key: `prod:${row.id}`,
          public_url: url,
          caption: `${kind}${label ? ` · ${label}` : ""}`,
        });
      }
    }

    const { data: lines, error: lErr } = await supabase
      .from("store_order_items")
      .select("product_name, placements, notes")
      .eq("order_id", orderUuid);

    if (!lErr && lines?.length) {
      let urlIdx = 0;
      for (const rawLine of lines) {
        const line = rawLine as { product_name: string | null; placements: unknown; notes: string | null };
        const pname = (line.product_name ?? "").trim() || "Item";
        const textSources: Array<{ label: string; text: string }> = [];
        for (const s of placementsFromDb(line.placements)) {
          textSources.push({ label: "Checkout line", text: s });
        }
        const memo = (line.notes ?? "").trim();
        if (memo) {
          textSources.push({ label: "Checkout notes", text: memo });
        }
        for (const { label, text } of textSources) {
          for (const url of extractHttpUrlsFromText(text)) {
            let normalized = url;
            try {
              normalized = new URL(url).href;
            } catch {
              continue;
            }
            if (seen.has(normalized)) {
              continue;
            }
            if (!looksLikeCustomerProvidedAssetUrl(normalized)) {
              continue;
            }
            seen.add(normalized);
            urlIdx += 1;
            items.push({
              key: `line:${urlIdx}:${normalized.slice(0, 64)}`,
              public_url: normalized,
              caption: `${label} · ${pname}`,
            });
          }
        }
      }
    }

    return { ok: true, items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

export type UploadClickUpSheetImageResult =
  | { ok: true; image: ClickUpSheetImageDto }
  | { ok: false; error: string };

export async function uploadClickUpSheetImage(formData: FormData): Promise<UploadClickUpSheetImageResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const listDate = parseListDateYmd(String(formData.get("list_date") ?? ""));
  if (!listDate) {
    return { ok: false, error: "Worksheet date is missing or invalid." };
  }

  const customerOrderId = String(formData.get("customer_order_id") ?? "").trim();
  if (customerOrderId) {
    const qg = await guardCustomerOrderNumberNotInCompleteOrdersQueue(customerOrderId);
    if (!qg.ok) {
      return { ok: false, error: qg.error };
    }
  }
  const file = formData.get("file");
  const isMockup =
    String(formData.get("is_mockup") ?? "").toLowerCase() === "true" ||
    String(formData.get("is_mockup") ?? "") === "1";

  let mockupDecorateMethodsJson: string | null = null;
  let mockupMemo: string | null = null;
  if (isMockup) {
    const rawMethods = formData.get("mockup_decorate_methods");
    let parsed: unknown = [];
    if (typeof rawMethods === "string" && rawMethods.trim()) {
      try {
        parsed = JSON.parse(rawMethods) as unknown;
      } catch {
        parsed = [];
      }
    }
    const sanitized = sanitizeMockupDecorateMethodsFromClient(parsed);
    mockupDecorateMethodsJson = sanitized.length ? JSON.stringify(sanitized) : null;

    if (formData.has("mockup_memo")) {
      const t = String(formData.get("mockup_memo") ?? "").trim().slice(0, 2000);
      mockupMemo = t.length > 0 ? t : null;
    }
  }

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file." };
  }

  const mime = resolveUploadMimeForClickUp(file, isMockup);
  if (!mime) {
    return {
      ok: false,
      error: isMockup
        ? "Use JPEG, PNG, GIF, WebP, or PDF for mock-ups."
        : "Use JPEG, PNG, GIF, or WebP.",
    };
  }

  const maxBytes = maxBytesForMime(mime);
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `File must be at most ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    };
  }

  const storagePath = buildClickUpImageStoragePath(listDate, customerOrderId, file, mime);

  try {
    const supabase = createSupabaseAdminClient();

    const filter = supabase
      .from("click_up_sheet_images")
      .select("sort_order")
      .eq("list_date", listDate)
      .eq("customer_order_id", customerOrderId)
      .eq("is_mockup", isMockup);

    const { data: topRow } = await filter.order("sort_order", { ascending: false }).limit(1).maybeSingle();

    const nextSort = (topRow?.sort_order ?? -1) + 1;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(CLICK_UP_SHEET_IMAGES_BUCKET)
      .upload(storagePath, buf, { contentType: mime, upsert: false });

    if (upErr) {
      return { ok: false, error: formatClickUpSheetStorageError(upErr.message) };
    }

    const { data: row, error: insErr } = await supabase
      .from("click_up_sheet_images")
      .insert({
        list_date: listDate,
        customer_order_id: customerOrderId,
        storage_path: storagePath,
        sort_order: nextSort,
        is_mockup: isMockup,
        ...(isMockup
          ? { mockup_decorate_methods: mockupDecorateMethodsJson, mockup_memo: mockupMemo }
          : {}),
      })
      .select(
        "id, list_date, customer_order_id, storage_path, sort_order, created_at, is_mockup, mockup_decorate_methods, mockup_memo",
      )
      .single();

    if (insErr || !row) {
      await supabase.storage.from(CLICK_UP_SHEET_IMAGES_BUCKET).remove([storagePath]);
      return { ok: false, error: insErr?.message ?? "Could not save image record." };
    }

    return {
      ok: true,
      image: {
        id: row.id,
        list_date: row.list_date,
        customer_order_id: row.customer_order_id ?? "",
        storage_path: row.storage_path,
        public_url: publicStorageObjectUrl(CLICK_UP_SHEET_IMAGES_BUCKET, row.storage_path),
        sort_order: row.sort_order,
        created_at: row.created_at,
        is_mockup: Boolean((row as { is_mockup?: boolean }).is_mockup),
        mockup_decorate_methods: (row as { mockup_decorate_methods?: string | null }).mockup_decorate_methods ?? null,
        mockup_memo: (row as { mockup_memo?: string | null }).mockup_memo ?? null,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { ok: false, error: msg };
  }
}

export async function deleteClickUpSheetImage(
  imageId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = imageId.trim();
  if (!id) {
    return { ok: false, error: "Invalid image id." };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: row, error: fetchErr } = await supabase
      .from("click_up_sheet_images")
      .select("storage_path, customer_order_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return { ok: false, error: fetchErr.message };
    }
    if (!row) {
      return { ok: false, error: "Image not found." };
    }

    const cid = String((row as { customer_order_id?: string | null }).customer_order_id ?? "").trim();
    if (cid) {
      const qg = await guardCustomerOrderNumberNotInCompleteOrdersQueue(cid);
      if (!qg.ok) {
        return { ok: false, error: qg.error };
      }
    }

    const { error: delDbErr } = await supabase.from("click_up_sheet_images").delete().eq("id", id);
    if (delDbErr) {
      return { ok: false, error: delDbErr.message };
    }

    await supabase.storage.from(CLICK_UP_SHEET_IMAGES_BUCKET).remove([row.storage_path]);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return { ok: false, error: msg };
  }
}

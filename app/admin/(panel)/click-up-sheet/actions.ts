"use server";

import { randomUUID } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";

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
import {
  queryClickUpMockupImagesByCustomerOrderId,
  queryClickUpMockupImagesByCustomerOrderIdIncludingReorder,
} from "@/lib/fetch-click-up-mockups";
import { appendClickUpProductionQueueSetupHint } from "@/lib/supabase-click-up-production-queue-hint";
import { createSupabaseAdminClient } from "@/lib/supabase";

const CLICK_UP_SHEET_IMAGES_BUCKET = "click-up-sheet-images";
const MAX_CLICK_UP_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CLICK_UP_PDF_BYTES = 20 * 1024 * 1024;
const CLICK_UP_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

async function customerEmailForStoreOrderNumber(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orderNumber: string,
): Promise<string | null> {
  const on = orderNumber.trim();
  if (!on) return null;
  const { data, error } = await supabase.from("store_orders").select("customer_email").eq("order_number", on).maybeSingle();
  if (error || !data) return null;
  const email = String((data as { customer_email?: string | null }).customer_email ?? "").trim();
  return email.length > 0 ? email : null;
}

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

    /** Customer My account + track page: mark Processing step complete in delivery timeline (`lib/order-track-delivery`). */
    const { data: trackingRow } = await supabase
      .from("store_orders")
      .select("tracking_token")
      .eq("id", resolved.productionOrderId)
      .maybeSingle();

    const { error: statusErr } = await supabase
      .from("store_orders")
      .update({ status: "processing" })
      .eq("id", resolved.productionOrderId)
      .not("status", "eq", "shipped")
      .not("status", "eq", "cancelled");
    if (statusErr) {
      return { ok: false, error: statusErr.message };
    }

    revalidatePath("/admin/production");
    revalidatePath(`/admin/production/${resolved.productionOrderId}`);
    revalidatePath("/admin/work-process");
    revalidatePath("/customer");
    /** Bust client Router Cache / prefetched admin routes so Production list shows the new queue row immediately. */
    revalidatePath("/admin", "layout");
    const tt = trackingRow?.tracking_token?.trim();
    if (tt) {
      revalidatePath(`/orders/track/${tt}`);
    }
    refresh();
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
  is_master_logo?: boolean;
  /** JSON array string from Add mock-up modal, e.g. `["Embroidery","DTF/HTV"]`. */
  mockup_decorate_methods: string | null;
  /** Optional note from Edit mock-up (MEMO). */
  mockup_memo: string | null;
  /**
   * When set, this mock-up row is shown from a prior store order (customer Reorder). Same DB row as the source order —
   * do not delete/edit from the new order’s sheet UI.
   */
  inherited_from_order_number?: string | null;
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
    const listDateForOrder = listDate;

    // If the customer has a master logo saved, auto-attach/mark it on this order’s reference images.
    if (assetFilter === "reference" && orderId.length > 0) {
      const email = await customerEmailForStoreOrderNumber(supabase, orderId);
      if (email) {
        const { data: masterRow } = await supabase
          .from("customer_master_company_logo")
          .select("storage_bucket, storage_path")
          .eq("customer_email", email)
          .maybeSingle();
        const mr = masterRow
          ? (masterRow as { storage_path?: string | null; storage_bucket?: string | null })
          : null;
        const masterPath = String(mr?.storage_path ?? "").trim();
        const masterBucket =
          String(mr?.storage_bucket ?? CLICK_UP_SHEET_IMAGES_BUCKET).trim() || CLICK_UP_SHEET_IMAGES_BUCKET;

        if (masterPath) {
          const { data: existingMasters } = await supabase
            .from("click_up_sheet_images")
            .select("id")
            .eq("list_date", listDateForOrder)
            .eq("customer_order_id", orderId)
            .eq("is_mockup", false)
            .eq("is_master_logo", true)
            .limit(1);

          if (!existingMasters?.length) {
            const { data: match } = await supabase
              .from("click_up_sheet_images")
              .select("id")
              .eq("list_date", listDateForOrder)
              .eq("customer_order_id", orderId)
              .eq("is_mockup", false)
              .eq("storage_path", masterPath)
              .limit(1);

            if (match?.length) {
              await supabase
                .from("click_up_sheet_images")
                .update({ is_master_logo: true })
                .eq("id", match[0]!.id);
            } else if (masterBucket === CLICK_UP_SHEET_IMAGES_BUCKET) {
              const { data: topRow } = await supabase
                .from("click_up_sheet_images")
                .select("sort_order")
                .eq("list_date", listDateForOrder)
                .eq("customer_order_id", orderId)
                .eq("is_mockup", false)
                .order("sort_order", { ascending: false })
                .limit(1)
                .maybeSingle();
              const nextSort = (topRow?.sort_order ?? -1) + 1;
              await supabase.from("click_up_sheet_images").insert({
                list_date: listDateForOrder,
                customer_order_id: orderId,
                storage_path: masterPath,
                sort_order: nextSort,
                is_mockup: false,
                is_master_logo: true,
              });
            }
          }
        }
      }
    }

    let q =
      orderId.length > 0
        ? supabase
            .from("click_up_sheet_images")
            .select(
              "id, list_date, customer_order_id, storage_path, sort_order, created_at, is_mockup, is_master_logo, mockup_decorate_methods, mockup_memo",
            )
            .eq("list_date", listDate)
            .eq("customer_order_id", orderId)
        : supabase
            .from("click_up_sheet_images")
            .select(
              "id, list_date, customer_order_id, storage_path, sort_order, created_at, is_mockup, is_master_logo, mockup_decorate_methods, mockup_memo",
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
      is_master_logo: Boolean((r as { is_master_logo?: boolean }).is_master_logo),
      mockup_decorate_methods: (r as { mockup_decorate_methods?: string | null }).mockup_decorate_methods ?? null,
      mockup_memo: (r as { mockup_memo?: string | null }).mockup_memo ?? null,
    }));

    return { ok: true, images };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

function escapeCustomerEmailForIlike(email: string): string {
  return email.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * When `reordered_from_store_order_id` is missing (legacy checkout), find the most recent older order for the same
 * email that already has Click up mock-ups. Best-effort only; explicit reorder link is preferred.
 */
async function findLatestPriorOrderNumberWithMockupsForEmail(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  args: { currentOrderNumber: string; customerEmail: string; createdAtIso: string },
): Promise<string | null> {
  const email = args.customerEmail.trim();
  const createdAt = args.createdAtIso.trim();
  const on = args.currentOrderNumber.trim();
  if (!email || !createdAt || !on) {
    return null;
  }
  const { data: candidates, error } = await supabase
    .from("store_orders")
    .select("order_number, created_at")
    .ilike("customer_email", escapeCustomerEmailForIlike(email))
    .neq("order_number", on)
    .lt("created_at", createdAt)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error || !candidates?.length) {
    return null;
  }
  for (const c of candidates) {
    const n = (c.order_number ?? "").trim();
    if (!n) {
      continue;
    }
    const mq = await queryClickUpMockupImagesByCustomerOrderId(supabase, n);
    if (mq.ok && mq.rows.length > 0) {
      return n;
    }
  }
  return null;
}

/**
 * Mock-ups for this Perth worksheet + Order ID, plus mock-ups from the **prior** store order when this order was
 * created via customer Reorder (`store_orders.reordered_from_store_order_id`).
 */
export async function listClickUpSheetMockupsIncludingReorderPrior(
  listDateYmd: string,
  customerOrderId: string,
): Promise<{ ok: true; images: ClickUpSheetImageDto[] } | { ok: false; error: string }> {
  const current = await listClickUpSheetImages(listDateYmd, customerOrderId, "mockup");
  if (!current.ok) {
    return current;
  }
  const on = customerOrderId.trim();
  const own = current.images.map((i) => ({ ...i, inherited_from_order_number: null as string | null }));
  if (!on) {
    return { ok: true, images: own };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: true, images: own };
  }

  const { data: orderRow, error: ordErr } = await supabase
    .from("store_orders")
    .select("reordered_from_store_order_id, customer_email, created_at, order_number")
    .eq("order_number", on)
    .maybeSingle();

  if (ordErr || !orderRow) {
    return { ok: true, images: own };
  }

  let prevNum: string | null = null;

  const prevId = (orderRow.reordered_from_store_order_id ?? "").trim();
  if (prevId && /^[0-9a-f-]{36}$/i.test(prevId)) {
    const { data: srcOrder } = await supabase
      .from("store_orders")
      .select("order_number")
      .eq("id", prevId)
      .maybeSingle();
    prevNum = (srcOrder?.order_number ?? "").trim();
  }

  if (!prevNum) {
    const email = (orderRow.customer_email ?? "").trim();
    const createdAt = (orderRow.created_at ?? "").trim();
    if (email && createdAt) {
      prevNum = await findLatestPriorOrderNumberWithMockupsForEmail(supabase, {
        currentOrderNumber: on,
        customerEmail: email,
        createdAtIso: createdAt,
      });
    }
  }

  if (!prevNum || prevNum === on) {
    return { ok: true, images: own };
  }

  const prior = await queryClickUpMockupImagesByCustomerOrderId(supabase, prevNum);
  if (!prior.ok) {
    return { ok: true, images: own };
  }

  const seenPaths = new Set(own.map((i) => i.storage_path));
  const inherited: ClickUpSheetImageDto[] = [];
  for (const row of prior.rows) {
    if (!row.storage_path || seenPaths.has(row.storage_path)) {
      continue;
    }
    seenPaths.add(row.storage_path);
    inherited.push({
      id: row.id,
      list_date: row.list_date,
      customer_order_id: row.customer_order_id,
      storage_path: row.storage_path,
      public_url: row.public_url,
      sort_order: row.sort_order,
      created_at: row.created_at,
      is_mockup: true,
      mockup_decorate_methods: row.mockup_decorate_methods,
      mockup_memo: row.mockup_memo,
      inherited_from_order_number: prevNum,
    });
  }

  return { ok: true, images: [...own, ...inherited] };
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
    const result = await queryClickUpMockupImagesByCustomerOrderIdIncludingReorder(supabase, id);
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

function parseSupabasePublicObjectUrl(url: string): { bucket: string; path: string } | null {
  const u = url.trim();
  if (!u) return null;
  // Example: https://xyz.supabase.co/storage/v1/object/public/<bucket>/<path>
  const m = u.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(?:\?|$)/i);
  if (!m) return null;
  const bucket = (m[1] ?? "").trim();
  const rawPath = (m[2] ?? "").trim();
  if (!bucket || !rawPath) return null;
  let path = rawPath;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    path = rawPath;
  }
  return { bucket, path };
}

export type CustomerReferenceVisualDto = {
  key: string;
  public_url: string;
  caption: string;
  /** When present, asset is a Supabase Storage object we can persist as customer master logo. */
  storage_bucket?: string;
  storage_path?: string;
  is_master_logo?: boolean;
};

/**
 * Order visuals for Click Up: saved **customer master logo** is listed first when configured; additional production and
 * checkout-line URLs follow in sequence (`production_order_assets` by `created_at` ascending, then extracted image URLs).
 * If the master file is also attached on the order, it appears only once (as the lead tile).
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
      .select("id, customer_email")
      .eq("order_number", id)
      .maybeSingle();

    if (soErr || !so) {
      return { ok: true, items: [] };
    }

    const orderUuid = so.id;
    const customerEmail = String((so as { customer_email?: string | null }).customer_email ?? "")
      .trim()
      .toLowerCase();
    const items: CustomerReferenceVisualDto[] = [];
    const seen = new Set<string>();

    const customerMaster = customerEmail
      ? await supabase
          .from("customer_master_company_logo")
          .select("storage_bucket, storage_path")
          .eq("customer_email", customerEmail)
          .maybeSingle()
      : { data: null as unknown };
    const masterBucket = String(
      (customerMaster as { data?: { storage_bucket?: string | null } | null })?.data?.storage_bucket ??
        PRODUCTION_ORDER_ASSETS_BUCKET,
    ).trim();
    const masterPath = String(
      (customerMaster as { data?: { storage_path?: string | null } | null })?.data?.storage_path ?? "",
    ).trim();

    const { data: assets, error: aErr } = await supabase
      .from("production_order_assets")
      .select("id, kind, label, storage_bucket, storage_path, created_at")
      .eq("order_id", orderUuid)
      .order("created_at", { ascending: true });

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
        const isMaster = Boolean(masterPath) && bucket === masterBucket && row.storage_path === masterPath;
        items.push({
          key: `prod:${row.id}`,
          public_url: url,
          caption: `${kind}${label ? ` · ${label}` : ""}`,
          storage_bucket: bucket,
          storage_path: row.storage_path,
          is_master_logo: isMaster,
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
            const storage = parseSupabasePublicObjectUrl(normalized);
            const isMaster =
              storage != null &&
              Boolean(masterPath) &&
              storage.bucket === masterBucket &&
              storage.path === masterPath;
            items.push({
              key: `line:${urlIdx}:${normalized.slice(0, 64)}`,
              public_url: normalized,
              caption: `${label} · ${pname}`,
              ...(storage ? { storage_bucket: storage.bucket, storage_path: storage.path, is_master_logo: isMaster } : {}),
            });
          }
        }
      }
    }

    /** Always show saved master first; same file linked on the order appears only once (here). */
    if (masterPath) {
      const bucketForMaster = masterBucket || PRODUCTION_ORDER_ASSETS_BUCKET;
      const masterPublicUrl = publicStorageObjectUrl(bucketForMaster, masterPath);
      if (masterPublicUrl) {
        const rest = items.filter((row) => row.public_url !== masterPublicUrl);
        items.length = 0;
        items.push(
          {
            key: "customer-master:lead",
            public_url: masterPublicUrl,
            caption: "Master logo",
            storage_bucket: bucketForMaster,
            storage_path: masterPath,
            is_master_logo: true,
          },
          ...rest,
        );
      }
    }

    return { ok: true, items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

export async function setCustomerMasterCompanyLogoFromOrderAsset(args: {
  orderNumber: string;
  storageBucket: string;
  storagePath: string;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const orderNumber = args.orderNumber.trim();
  const storageBucket = args.storageBucket.trim();
  const storagePath = args.storagePath.trim();
  if (!orderNumber || !storageBucket || !storagePath) {
    return { ok: false, error: "Missing order/logo parameters." };
  }

  const qg = await guardCustomerOrderNumberNotInCompleteOrdersQueue(orderNumber);
  if (!qg.ok) {
    return { ok: false, error: qg.error };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const email = await customerEmailForStoreOrderNumber(supabase, orderNumber);
    if (!email) {
      return { ok: false, error: "Could not resolve customer email for this order." };
    }
    const emailLower = email.toLowerCase();

    if (args.enabled) {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("customer_master_company_logo")
        .upsert(
          {
            customer_email: emailLower,
            storage_bucket: storageBucket,
            storage_path: storagePath,
            updated_at: nowIso,
          },
          { onConflict: "customer_email" },
        );
      if (error) {
        return { ok: false, error: error.message };
      }
    } else {
      const { data: cur } = await supabase
        .from("customer_master_company_logo")
        .select("storage_bucket, storage_path")
        .eq("customer_email", emailLower)
        .maybeSingle();
      const curBucket = String((cur as { storage_bucket?: string | null })?.storage_bucket ?? "").trim();
      const curPath = String((cur as { storage_path?: string | null })?.storage_path ?? "").trim();
      if (curBucket === storageBucket && curPath === storagePath) {
        await supabase.from("customer_master_company_logo").delete().eq("customer_email", emailLower);
      }
    }

    refresh();
    revalidatePath("/admin/click-up-sheet");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

export async function getCustomerMasterCompanyLogoForStoreOrderNumber(
  orderNumber: string,
): Promise<{ ok: true; public_url: string | null } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const on = orderNumber.trim();
  if (!on) {
    return { ok: true, public_url: null };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const email = await customerEmailForStoreOrderNumber(supabase, on);
    if (!email) {
      return { ok: true, public_url: null };
    }
    const emailLower = email.toLowerCase();
    const { data, error } = await supabase
      .from("customer_master_company_logo")
      .select("storage_bucket, storage_path")
      .eq("customer_email", emailLower)
      .maybeSingle();
    if (error) {
      return { ok: false, error: error.message };
    }
    const bucket = String((data as { storage_bucket?: string | null })?.storage_bucket ?? "").trim();
    const path = String((data as { storage_path?: string | null })?.storage_path ?? "").trim();
    if (!bucket || !path) {
      return { ok: true, public_url: null };
    }
    return { ok: true, public_url: publicStorageObjectUrl(bucket, path) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
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
        "id, list_date, customer_order_id, storage_path, sort_order, created_at, is_mockup, is_master_logo, mockup_decorate_methods, mockup_memo",
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
        is_master_logo: Boolean((row as { is_master_logo?: boolean }).is_master_logo),
        mockup_decorate_methods: (row as { mockup_decorate_methods?: string | null }).mockup_decorate_methods ?? null,
        mockup_memo: (row as { mockup_memo?: string | null }).mockup_memo ?? null,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { ok: false, error: msg };
  }
}

export async function setClickUpSheetMasterCompanyLogo(
  imageId: string,
  nextIsMaster: boolean,
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
      .select("id, list_date, customer_order_id, is_mockup, inherited_from_order_number, storage_path")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return { ok: false, error: fetchErr.message };
    }
    if (!row) {
      return { ok: false, error: "Image not found." };
    }

    const isMockup = Boolean((row as { is_mockup?: boolean }).is_mockup);
    if (isMockup) {
      return { ok: false, error: "Master logo can only be set on reference images." };
    }
    const inheritedFrom = String((row as { inherited_from_order_number?: string | null }).inherited_from_order_number ?? "")
      .trim();
    if (inheritedFrom) {
      return { ok: false, error: "Inherited mock-ups cannot be edited." };
    }

    const listDate = String((row as { list_date?: string }).list_date ?? "").trim();
    const customerOrderId = String((row as { customer_order_id?: string | null }).customer_order_id ?? "").trim();
    const storagePath = String((row as { storage_path?: string | null }).storage_path ?? "").trim();
    if (customerOrderId) {
      const qg = await guardCustomerOrderNumberNotInCompleteOrdersQueue(customerOrderId);
      if (!qg.ok) {
        return { ok: false, error: qg.error };
      }
    }

    if (nextIsMaster) {
      // Clear any prior master logo for this order/date, then set this row.
      const { error: clearErr } = await supabase
        .from("click_up_sheet_images")
        .update({ is_master_logo: false })
        .eq("list_date", listDate)
        .eq("customer_order_id", customerOrderId)
        .eq("is_mockup", false)
        .eq("is_master_logo", true);
      if (clearErr) {
        return { ok: false, error: clearErr.message };
      }
      const { error: setErr } = await supabase.from("click_up_sheet_images").update({ is_master_logo: true }).eq("id", id);
      if (setErr) {
        return { ok: false, error: setErr.message };
      }

      // Persist to customer-level master logo (by customer email from store_orders).
      const email = customerOrderId ? await customerEmailForStoreOrderNumber(supabase, customerOrderId) : null;
      if (email && storagePath) {
        const nowIso = new Date().toISOString();
        const { error: upErr } = await supabase
          .from("customer_master_company_logo")
          .upsert(
            {
              customer_email: email,
              storage_bucket: CLICK_UP_SHEET_IMAGES_BUCKET,
              storage_path: storagePath,
              updated_at: nowIso,
            },
            { onConflict: "customer_email" },
          );
        if (upErr) {
          return { ok: false, error: upErr.message };
        }
      }
    } else {
      const { error: unsetErr } = await supabase.from("click_up_sheet_images").update({ is_master_logo: false }).eq("id", id);
      if (unsetErr) {
        return { ok: false, error: unsetErr.message };
      }

      // If this logo was the customer master, clear it (customer can re-select later).
      const email = customerOrderId ? await customerEmailForStoreOrderNumber(supabase, customerOrderId) : null;
      if (email && storagePath) {
        const { data: cur } = await supabase
          .from("customer_master_company_logo")
          .select("storage_path")
          .eq("customer_email", email)
          .maybeSingle();
        const curPath = String((cur as { storage_path?: string | null })?.storage_path ?? "").trim();
        if (curPath && curPath === storagePath) {
          await supabase.from("customer_master_company_logo").delete().eq("customer_email", email);
        }
      }
    }

    refresh();
    revalidatePath("/admin/click-up-sheet");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
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

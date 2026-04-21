"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import { guardStoreOrderNotInCompleteOrdersQueue } from "@/lib/complete-orders-queue-mutation-block";
import { appendClickUpProductionQueueSetupHint } from "@/lib/supabase-click-up-production-queue-hint";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import { createSupabaseAdminClient } from "@/lib/supabase";

const BUCKET = "production-order-assets";
const MAX_BYTES = 20 * 1024 * 1024;

async function isStoreOrderInProductionQueue(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storeOrderId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("click_up_production_queue")
    .select("id")
    .eq("store_order_id", storeOrderId)
    .maybeSingle();
  if (error || !data?.id) {
    return false;
  }
  return true;
}

const KIND_SET = new Set(["logo", "embroidery_logo", "printing_logo", "mockup_design", "other"] as const);
export type ProductionAssetKind = (typeof KIND_SET extends Set<infer T> ? T : never) & string;

function sanitizeStorageSegment(s: string, max: number): string {
  const t = s.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (t || "file").slice(0, max);
}

function extFromName(name: string): string {
  const lower = (name || "").toLowerCase();
  const m = lower.match(/(\.[a-z0-9]{1,8})$/);
  return m ? m[1]! : "";
}

function buildStoragePath(orderId: string, kind: string, file: File): string {
  const orderSeg = sanitizeStorageSegment(orderId, 60);
  const kindSeg = sanitizeStorageSegment(kind, 40);
  const baseName = sanitizeStorageSegment((file.name || "file").replace(/\.[^.]+$/, ""), 80);
  const ext = extFromName(file.name);
  return `${orderSeg}/${kindSeg}/${randomUUID()}_${baseName}${ext}`;
}

export type ProductionAssetDto = {
  id: string;
  order_id: string;
  kind: string;
  label: string;
  storage_bucket: string;
  storage_path: string;
  public_url: string;
  created_at: string;
};

export async function listProductionAssets(orderId: string): Promise<{ ok: true; assets: ProductionAssetDto[] } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = orderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: true, assets: [] };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const allowed = await isStoreOrderInProductionQueue(supabase, id);
    if (!allowed) {
      return {
        ok: false,
        error:
          "Production pack has not been started for this order. Use Click up sheet → Move to Production first.",
      };
    }

    const { data, error } = await supabase
      .from("production_order_assets")
      .select("id, order_id, kind, label, storage_bucket, storage_path, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false });

    if (error) return { ok: false, error: error.message };

    const assets: ProductionAssetDto[] = (data ?? []).map((r) => ({
      ...r,
      storage_bucket: r.storage_bucket ?? BUCKET,
      public_url: publicStorageObjectUrl(r.storage_bucket ?? BUCKET, r.storage_path),
    }));
    return { ok: true, assets };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

export async function uploadProductionAsset(
  orderId: string,
  kindRaw: string,
  labelRaw: string,
  file: File,
): Promise<{ ok: true; asset: ProductionAssetDto } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = orderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid order" };
  }

  const completeGuard = await guardStoreOrderNotInCompleteOrdersQueue(id);
  if (!completeGuard.ok) {
    return { ok: false, error: completeGuard.error };
  }

  const kind = kindRaw.trim();
  if (!KIND_SET.has(kind as any)) {
    return { ok: false, error: "Invalid kind" };
  }

  const label = labelRaw.trim().slice(0, 140);

  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return { ok: false, error: "Choose a file" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `File too large (max ${(MAX_BYTES / (1024 * 1024)).toFixed(0)}MB)` };
  }

  const storagePath = buildStoragePath(id, kind, file);

  try {
    const supabase = createSupabaseAdminClient();
    const allowed = await isStoreOrderInProductionQueue(supabase, id);
    if (!allowed) {
      return {
        ok: false,
        error:
          "Production pack has not been started for this order. Use Click up sheet → Move to Production first.",
      };
    }

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });
    if (upErr) {
      return { ok: false, error: upErr.message };
    }

    const { data, error: insErr } = await supabase
      .from("production_order_assets")
      .insert({
        order_id: id,
        kind,
        label,
        storage_bucket: BUCKET,
        storage_path: storagePath,
      })
      .select("id, order_id, kind, label, storage_bucket, storage_path, created_at")
      .maybeSingle();

    if (insErr || !data) {
      return { ok: false, error: insErr?.message ?? "Insert failed" };
    }

    const asset: ProductionAssetDto = {
      ...data,
      public_url: publicStorageObjectUrl(data.storage_bucket ?? BUCKET, data.storage_path),
    };

    revalidatePath("/admin/production");
    revalidatePath(`/admin/production/${id}`);
    return { ok: true, asset };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { ok: false, error: msg };
  }
}

export async function deleteProductionAsset(
  assetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = assetId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid asset" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: row, error: fetchErr } = await supabase
      .from("production_order_assets")
      .select("id, order_id, storage_bucket, storage_path")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !row) {
      return { ok: false, error: "Asset not found" };
    }

    const completeGuard = await guardStoreOrderNotInCompleteOrdersQueue(row.order_id);
    if (!completeGuard.ok) {
      return { ok: false, error: completeGuard.error };
    }

    const allowed = await isStoreOrderInProductionQueue(supabase, row.order_id);
    if (!allowed) {
      return {
        ok: false,
        error:
          "Production pack has not been started for this order. Use Click up sheet → Move to Production first.",
      };
    }

    // Delete storage object (best-effort).
    if (row.storage_path) {
      const bucket = row.storage_bucket ?? BUCKET;
      await supabase.storage.from(bucket).remove([row.storage_path]);
    }

    const { error: delErr } = await supabase.from("production_order_assets").delete().eq("id", id);
    if (delErr) return { ok: false, error: delErr.message };

    revalidatePath("/admin/production");
    revalidatePath(`/admin/production/${row.order_id}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return { ok: false, error: msg };
  }
}

export type ClickUpProductionQueueRowDto = {
  queueId: string;
  storeOrderId: string;
  listDate: string;
  movedAt: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
};

/** Orders that have an active Production pack (Click up sheet → Move to Production). */
export async function listClickUpProductionQueue(): Promise<
  { ok: true; rows: ClickUpProductionQueueRowDto[] } | { ok: false; error: string }
> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: qrows, error: qErr } = await supabase
      .from("click_up_production_queue")
      .select("id, store_order_id, list_date, moved_at")
      .order("moved_at", { ascending: false });

    if (qErr) {
      return { ok: false, error: appendClickUpProductionQueueSetupHint(qErr.message) };
    }

    const queue = qrows ?? [];
    if (queue.length === 0) {
      return { ok: true, rows: [] };
    }

    const ids = [...new Set(queue.map((r) => r.store_order_id).filter(Boolean))];
    const { data: orders, error: oErr } = await supabase
      .from("store_orders")
      .select("id, order_number, status, customer_name, customer_email")
      .in("id", ids);

    if (oErr) {
      return { ok: false, error: oErr.message };
    }

    const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));

    const rows: ClickUpProductionQueueRowDto[] = queue.map((q) => {
      const o = orderMap.get(q.store_order_id);
      return {
        queueId: q.id,
        storeOrderId: q.store_order_id,
        listDate: q.list_date ?? "",
        movedAt: q.moved_at,
        orderNumber: o?.order_number ?? "—",
        status: o?.status ?? "—",
        customerName: o?.customer_name ?? "",
        customerEmail: o?.customer_email ?? "",
      };
    });

    return { ok: true, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

export async function hasProductionPackForStoreOrder(orderId: string): Promise<boolean> {
  try {
    await assertAdminSession();
  } catch {
    return false;
  }
  const id = orderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return false;
  }
  try {
    const supabase = createSupabaseAdminClient();
    return isStoreOrderInProductionQueue(supabase, id);
  } catch {
    return false;
  }
}

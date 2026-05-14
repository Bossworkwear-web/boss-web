"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSessionForPathSegment } from "@/lib/admin-auth";
import { appendClickUpCompleteOrdersQueueSetupHint } from "@/lib/supabase-click-up-complete-orders-queue-hint";
import { appendClickUpDispatchQueueSetupHint } from "@/lib/supabase-click-up-dispatch-queue-hint";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type ClickUpDispatchQueueRowDto = {
  queueId: string;
  storeOrderId: string;
  listDate: string;
  movedAt: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  /** Public URLs of carrier label images (AusPost etc.) attached on Dispatch. */
  carrierLabelImageUrls: string[];
};

/** Orders sent to Dispatch from Quality Check sheet (Move to Dispatch). */
export async function listClickUpDispatchQueue(): Promise<
  { ok: true; rows: ClickUpDispatchQueueRowDto[] } | { ok: false; error: string }
> {
  try {
    await assertAdminSessionForPathSegment("/admin/dispatch");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: qrows, error: qErr } = await supabase
      .from("click_up_dispatch_queue")
      .select("id, store_order_id, list_date, moved_at, carrier_label_image_urls")
      .order("moved_at", { ascending: false });

    if (qErr) {
      return { ok: false, error: appendClickUpDispatchQueueSetupHint(qErr.message) };
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

    const rows: ClickUpDispatchQueueRowDto[] = queue.map((q) => {
      const o = orderMap.get(q.store_order_id);
      const labelUrlsRaw = (q as { carrier_label_image_urls?: unknown }).carrier_label_image_urls;
      const carrierLabelImageUrls = Array.isArray(labelUrlsRaw)
        ? labelUrlsRaw.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        : [];

      return {
        queueId: q.id,
        storeOrderId: q.store_order_id,
        listDate: q.list_date ?? "",
        movedAt: q.moved_at,
        orderNumber: o?.order_number ?? "—",
        status: o?.status ?? "—",
        customerName: o?.customer_name ?? "",
        customerEmail: o?.customer_email ?? "",
        carrierLabelImageUrls,
      };
    });

    return { ok: true, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

function looksLikeMissingMoveToCompleteRpc(err: { message?: string }): boolean {
  const m = (err.message ?? "").toLowerCase();
  return (
    m.includes("pgrst202") ||
    m.includes("could not find the function") ||
    (m.includes("schema cache") && m.includes("function"))
  );
}

/**
 * Customer delivery timeline: `Dispatch` step is `complete` only when `status === "shipped"` (`lib/order-track-delivery`).
 */
async function markStoreOrderDispatchedForCustomerTimeline(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storeOrderId: string,
): Promise<{ ok: true; trackingToken: string | null } | { ok: false; error: string }> {
  const nowIso = new Date().toISOString();
  const { data: row, error: selErr } = await supabase
    .from("store_orders")
    .select("status, shipped_at, tracking_token")
    .eq("id", storeOrderId)
    .maybeSingle();

  if (selErr) {
    return { ok: false, error: selErr.message };
  }
  if (!row) {
    return { ok: false, error: "store_order_not_found" };
  }
  if ((row.status ?? "").toLowerCase() === "cancelled") {
    return { ok: true, trackingToken: row.tracking_token?.trim() ?? null };
  }

  const { error: upErr } = await supabase
    .from("store_orders")
    .update({
      status: "shipped",
      ...(row.shipped_at ? {} : { shipped_at: nowIso }),
    })
    .eq("id", storeOrderId);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  return { ok: true, trackingToken: row.tracking_token?.trim() ?? null };
}

export type MoveDispatchQueueToCompleteResult =
  | { ok: true; trackingToken: string | null }
  | { ok: false; error: string; invalidQueue?: boolean };

/**
 * Move one row from Dispatch queue to Completed Order (RPC when available; else upsert + delete).
 */
async function moveDispatchQueueRowToComplete(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  queueId: string,
): Promise<MoveDispatchQueueToCompleteResult> {
  const { data: drow, error: selErr } = await supabase
    .from("click_up_dispatch_queue")
    .select("store_order_id, list_date")
    .eq("id", queueId)
    .maybeSingle();

  if (selErr) {
    return { ok: false, error: selErr.message };
  }
  if (!drow?.store_order_id) {
    return { ok: false, error: "delivery_queue_not_found", invalidQueue: true };
  }

  const { error: rpcErr } = await supabase.rpc("move_store_order_from_delivery_to_complete", {
    p_delivery_queue_id: queueId,
  });

  if (!rpcErr) {
    return await markStoreOrderDispatchedForCustomerTimeline(supabase, drow.store_order_id);
  }

  if (rpcErr.message?.includes("delivery_queue_not_found")) {
    return { ok: false, error: rpcErr.message, invalidQueue: true };
  }

  if (!looksLikeMissingMoveToCompleteRpc(rpcErr)) {
    return { ok: false, error: rpcErr.message };
  }

  const { error: upErr } = await supabase.from("click_up_complete_orders_queue").upsert(
    {
      store_order_id: drow.store_order_id,
      list_date: (drow.list_date ?? "").trim(),
      completed_at: new Date().toISOString(),
    },
    { onConflict: "store_order_id" },
  );

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  const { error: delErr } = await supabase.from("click_up_dispatch_queue").delete().eq("id", queueId);

  if (delErr) {
    return { ok: false, error: delErr.message };
  }

  return await markStoreOrderDispatchedForCustomerTimeline(supabase, drow.store_order_id);
}

export async function completeDispatchQueueRow(formData: FormData): Promise<void> {
  try {
    await assertAdminSessionForPathSegment("/admin/dispatch");
  } catch {
    redirect("/admin/login");
  }

  const queueId = (formData.get("queue_id") ?? "").toString().trim();
  if (!UUID_RE.test(queueId)) {
    redirect("/admin/dispatch?complete_error=invalid_queue");
  }

  const supabase = createSupabaseAdminClient();
  const result = await moveDispatchQueueRowToComplete(supabase, queueId);

  if (!result.ok) {
    if (result.invalidQueue) {
      redirect("/admin/dispatch?complete_error=invalid_queue");
    }
    const msg = appendClickUpDispatchQueueSetupHint(
      appendClickUpCompleteOrdersQueueSetupHint(result.error),
    );
    const short = msg.length > 800 ? `${msg.slice(0, 800)}…` : msg;
    redirect(`/admin/dispatch?complete_error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/dispatch");
  revalidatePath("/admin/complete-orders");
  revalidatePath("/customer");
  if (result.trackingToken) {
    revalidatePath(`/orders/track/${result.trackingToken}`);
  }
  revalidatePath("/admin/store-orders");
  redirect("/admin/complete-orders");
}

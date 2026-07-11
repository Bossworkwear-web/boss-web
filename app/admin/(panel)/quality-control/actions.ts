"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSessionForPathSegment } from "@/lib/admin-auth";
import { storeOrderScanPayloadFromId } from "@/lib/store-order-scan-code";
import { guardStoreOrderNotInCompleteOrdersQueue } from "@/lib/complete-orders-queue-mutation-block";
import { resolveListDateForStoreOrderNumber } from "@/lib/resolve-store-order-list-date";
import { appendClickUpProductionQueueSetupHint } from "@/lib/supabase-click-up-production-queue-hint";
import { appendClickUpQcQueueSetupHint } from "@/lib/supabase-click-up-qc-queue-hint";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type ClickUpQcQueueRowDto = {
  queueId: string;
  storeOrderId: string;
  listDate: string;
  movedAt: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
};

/** Orders sent to Quality Control from Production pack (Move to QC). */
export async function listClickUpQualityCheckQueue(): Promise<
  { ok: true; rows: ClickUpQcQueueRowDto[] } | { ok: false; error: string }
> {
  try {
    await assertAdminSessionForPathSegment("/admin/quality-control");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: qrows, error: qErr } = await supabase
      .from("click_up_qc_queue")
      .select("id, store_order_id, list_date, moved_at")
      .order("moved_at", { ascending: false });

    if (qErr) {
      return { ok: false, error: appendClickUpQcQueueSetupHint(qErr.message) };
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

    const rows: ClickUpQcQueueRowDto[] = [];
    for (const q of queue) {
      const o = orderMap.get(q.store_order_id);
      let listDate = (q.list_date ?? "").trim();
      if (!listDate && o?.order_number) {
        listDate = await resolveListDateForStoreOrderNumber(supabase, o.order_number);
        if (listDate) {
          await supabase
            .from("click_up_qc_queue")
            .update({ list_date: listDate })
            .eq("store_order_id", q.store_order_id);
        }
      }
      rows.push({
        queueId: q.id,
        storeOrderId: q.store_order_id,
        listDate,
        movedAt: q.moved_at,
        orderNumber: o?.order_number ?? "—",
        status: o?.status ?? "—",
        customerName: o?.customer_name ?? "",
        customerEmail: o?.customer_email ?? "",
      });
    }

    return { ok: true, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

/**
 * Production pack → Move to QC: upsert QC queue row, remove from Production queue, return to Production list.
 */
export async function moveStoreOrderToQualityControlFromProduction(formData: FormData): Promise<void> {
  try {
    await assertAdminSessionForPathSegment("/admin/quality-control");
  } catch {
    redirect("/admin/login");
  }

  const storeOrderId = (formData.get("store_order_id") ?? "").toString().trim();
  if (!/^[0-9a-f-]{36}$/i.test(storeOrderId)) {
    redirect("/admin/production?qc_move_error=invalid_order");
  }

  const completeGuard = await guardStoreOrderNotInCompleteOrdersQueue(storeOrderId);
  if (!completeGuard.ok) {
    const short =
      completeGuard.error.length > 800 ? `${completeGuard.error.slice(0, 800)}…` : completeGuard.error;
    redirect(`/admin/production/${storeOrderId}?qc_move_error=${encodeURIComponent(short)}`);
  }

  const supabase = createSupabaseAdminClient();

  const { data: prodRow } = await supabase
    .from("click_up_production_queue")
    .select("list_date")
    .eq("store_order_id", storeOrderId)
    .maybeSingle();
  let listDate = (prodRow?.list_date ?? "").trim();
  if (!listDate) {
    const { data: order } = await supabase
      .from("store_orders")
      .select("order_number")
      .eq("id", storeOrderId)
      .maybeSingle();
    if (order?.order_number) {
      listDate = await resolveListDateForStoreOrderNumber(supabase, order.order_number);
    }
  }

  const { error } = await supabase.from("click_up_qc_queue").upsert(
    {
      store_order_id: storeOrderId,
      list_date: listDate,
      moved_at: new Date().toISOString(),
    },
    { onConflict: "store_order_id" },
  );

  if (error) {
    const msg = appendClickUpQcQueueSetupHint(error.message);
    const short = msg.length > 800 ? `${msg.slice(0, 800)}…` : msg;
    redirect(`/admin/production/${storeOrderId}?qc_move_error=${encodeURIComponent(short)}`);
  }

  const { error: delProdErr } = await supabase
    .from("click_up_production_queue")
    .delete()
    .eq("store_order_id", storeOrderId);

  if (delProdErr) {
    const msg = appendClickUpProductionQueueSetupHint(delProdErr.message);
    const short = msg.length > 800 ? `${msg.slice(0, 800)}…` : msg;
    redirect(`/admin/production/${storeOrderId}?qc_move_error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/production");
  revalidatePath("/admin/quality-control");
  revalidatePath(`/admin/production/${storeOrderId}`);
  redirect("/admin/production");
}

/** `store_orders.order_number` → Code128 payload (UUID without hyphens); admin session required. */
export async function getStoreOrderScanCodeByOrderNumber(orderNumber: string): Promise<string | null> {
  const t = orderNumber.trim();
  if (!t) return null;
  try {
    await assertAdminSessionForPathSegment("/admin/quality-control");
  } catch {
    return null;
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from("store_orders").select("id").eq("order_number", t).maybeSingle();
    return data?.id ? storeOrderScanPayloadFromId(data.id) : null;
  } catch {
    return null;
  }
}

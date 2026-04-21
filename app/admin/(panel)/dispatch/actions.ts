"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
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
};

/** Orders sent to Dispatch from Quality Check sheet (Move to Dispatch). */
export async function listClickUpDispatchQueue(): Promise<
  { ok: true; rows: ClickUpDispatchQueueRowDto[] } | { ok: false; error: string }
> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: qrows, error: qErr } = await supabase
      .from("click_up_dispatch_queue")
      .select("id, store_order_id, list_date, moved_at")
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
 * Move one row from Dispatch queue to Complete Orders (RPC when available; else upsert + delete).
 */
async function moveDispatchQueueRowToComplete(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  queueId: string,
): Promise<{ ok: true } | { ok: false; error: string; invalidQueue?: boolean }> {
  const { error: rpcErr } = await supabase.rpc("move_store_order_from_delivery_to_complete", {
    p_delivery_queue_id: queueId,
  });

  if (!rpcErr) {
    return { ok: true };
  }

  if (rpcErr.message?.includes("delivery_queue_not_found")) {
    return { ok: false, error: rpcErr.message, invalidQueue: true };
  }

  if (!looksLikeMissingMoveToCompleteRpc(rpcErr)) {
    return { ok: false, error: rpcErr.message };
  }

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

  return { ok: true };
}

export async function completeDispatchQueueRow(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
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
    let msg = appendClickUpDispatchQueueSetupHint(
      appendClickUpCompleteOrdersQueueSetupHint(result.error),
    );
    const short = msg.length > 800 ? `${msg.slice(0, 800)}…` : msg;
    redirect(`/admin/dispatch?complete_error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/dispatch");
  revalidatePath("/admin/complete-orders");
  redirect("/admin/complete-orders");
}

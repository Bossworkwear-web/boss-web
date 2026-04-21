"use server";

import { assertAdminSession } from "@/lib/admin-auth";
import { appendClickUpCompleteOrdersQueueSetupHint } from "@/lib/supabase-click-up-complete-orders-queue-hint";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type ClickUpCompleteOrdersQueueRowDto = {
  queueId: string;
  storeOrderId: string;
  listDate: string;
  completedAt: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
};

export async function listClickUpCompleteOrdersQueue(): Promise<
  { ok: true; rows: ClickUpCompleteOrdersQueueRowDto[] } | { ok: false; error: string }
> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: qrows, error: qErr } = await supabase
      .from("click_up_complete_orders_queue")
      .select("id, store_order_id, list_date, completed_at")
      .order("completed_at", { ascending: false });

    if (qErr) {
      return { ok: false, error: appendClickUpCompleteOrdersQueueSetupHint(qErr.message) };
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

    const rows: ClickUpCompleteOrdersQueueRowDto[] = queue.map((q) => {
      const o = orderMap.get(q.store_order_id);
      return {
        queueId: q.id,
        storeOrderId: q.store_order_id,
        listDate: q.list_date ?? "",
        completedAt: q.completed_at,
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

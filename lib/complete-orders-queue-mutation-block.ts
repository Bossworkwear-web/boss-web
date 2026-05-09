import { createSupabaseAdminClient } from "@/lib/supabase";

/** Shown when `click_up_complete_orders_queue` still holds this store order (finished / archive list). */
export const COMPLETE_ORDERS_QUEUE_MUTATION_BLOCKED =
  "이 주문은 완료 목록(Completed Order)에 있어 변경·Production 이동 등을 할 수 없습니다. Work process에서 단계를 확인하거나, Completed Order에서 해당 주문을 빼낸 뒤 다시 시도하세요.";

export async function guardStoreOrderNotInCompleteOrdersQueue(
  storeOrderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = storeOrderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: true };
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("click_up_complete_orders_queue")
      .select("id")
      .eq("store_order_id", id)
      .maybeSingle();
    if (error) {
      return { ok: true };
    }
    if (data?.id) {
      return { ok: false, error: COMPLETE_ORDERS_QUEUE_MUTATION_BLOCKED };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export async function guardCustomerOrderNumberNotInCompleteOrdersQueue(
  customerOrderNumber: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const on = customerOrderNumber.trim();
  if (!on) {
    return { ok: true };
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("id")
      .eq("order_number", on)
      .maybeSingle();
    if (error || !order?.id) {
      return { ok: true };
    }
    return guardStoreOrderNotInCompleteOrdersQueue(order.id);
  } catch {
    return { ok: true };
  }
}

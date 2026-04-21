export function appendClickUpCompleteOrdersQueueSetupHint(originalMessage: string): string {
  const m = originalMessage.toLowerCase();
  /** Table or RPC for Complete Orders; avoid matching generic "schema cache" alone. */
  if (
    m.includes("click_up_complete_orders_queue") ||
    m.includes("move_store_order_from_delivery_to_complete") ||
    (m.includes("could not find the table") && m.includes("complete_orders"))
  ) {
    return `${originalMessage} — Fix: Supabase → SQL Editor → run supabase/sql-editor/patch_click_up_complete_orders_queue.sql (same as migrations/20260451_click_up_complete_orders_queue.sql). Then Settings → API → Reload schema if needed.`;
  }
  return originalMessage;
}

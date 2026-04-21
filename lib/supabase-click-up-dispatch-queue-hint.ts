/** Appends setup hint when PostgREST errors reference the Dispatch queue table (or legacy name). */
export function appendClickUpDispatchQueueSetupHint(originalMessage: string): string {
  const m = originalMessage.toLowerCase();
  if (
    m.includes("click_up_dispatch_queue") ||
    m.includes("click_up_delivery_queue") ||
    (m.includes("could not find the table") && (m.includes("dispatch_queue") || m.includes("delivery_queue")))
  ) {
    return `${originalMessage} — Fix: Supabase → SQL Editor → run supabase/sql-editor/patch_click_up_dispatch_queue.sql (creates queue + rename + RPC in one go). Or run migrations 20260450_click_up_delivery_queue.sql then 20260455_rename_click_up_delivery_queue_to_dispatch.sql. Then Settings → API → Reload schema.`;
  }
  return originalMessage;
}

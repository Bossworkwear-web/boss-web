/**
 * When PostgREST returns "schema cache" / missing table, surface a fix path for admins.
 */
export function appendClickUpProductionQueueSetupHint(originalMessage: string): string {
  const m = originalMessage.toLowerCase();
  const looksMissing =
    m.includes("click_up_production_queue") ||
    m.includes("schema cache") ||
    (m.includes("relation") && m.includes("does not exist")) ||
    m.includes("could not find the table");

  if (!looksMissing) {
    return originalMessage;
  }

  return `${originalMessage} — Fix: Supabase Dashboard → SQL Editor → paste and run the full file supabase/sql-editor/patch_click_up_production_queue.sql (same as migrations/20260448_click_up_production_queue.sql). If the error persists, Dashboard → Settings → API → Reload schema.`;
}

/**
 * When PostgREST returns missing `click_up_qc_queue`, surface a fix path for admins.
 */
export function appendClickUpQcQueueSetupHint(originalMessage: string): string {
  const m = originalMessage.toLowerCase();
  const looksMissing =
    m.includes("click_up_qc_queue") ||
    m.includes("schema cache") ||
    (m.includes("relation") && m.includes("does not exist")) ||
    m.includes("could not find the table");

  if (!looksMissing) {
    return originalMessage;
  }

  return `${originalMessage} — Fix: Supabase → SQL Editor → run supabase/sql-editor/patch_click_up_qc_queue.sql (same as migrations/20260449_click_up_qc_queue.sql). Then Settings → API → Reload schema if needed.`;
}

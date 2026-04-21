import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase";

/**
 * Lists quote leads with overdue follow-ups (for cron monitors / Zapier / n8n).
 * Schedule: GET /api/cron/crm-followups with Authorization: Bearer $CRON_SECRET
 * Wire email/SMS digests in your automation tool, or use Admin → CRM for manual follow-up.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data: due, error } = await supabase
      .from("quote_requests")
      .select("id, company_name, contact_name, email, phone, next_follow_up_at, pipeline_stage")
      .lte("next_follow_up_at", now)
      .neq("pipeline_stage", "completion")
      .eq("automation_paused", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      checked_at: now,
      overdue_count: due?.length ?? 0,
      overdue: due ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

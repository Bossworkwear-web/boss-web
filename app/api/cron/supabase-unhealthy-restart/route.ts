import { NextResponse } from "next/server";

import { sendSupabaseUnhealthyRestartAlert } from "@/lib/supabase-unhealthy-restart-alert";
import {
  decideSupabaseAutoRestart,
  fetchSupabaseProjectStatus,
  probeSupabaseInstanceApi,
  restartSupabaseProject,
  supabaseProjectRefFromUrl,
} from "@/lib/supabase-project-health-restart";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Lightweight probe of the live Supabase REST API. If the instance is hung (timeout / 52x),
 * restart it via the Management API.
 *
 * GET /api/cron/supabase-unhealthy-restart
 * Authorization: Bearer $CRON_SECRET
 *
 * Requires Vercel env `SUPABASE_ACCESS_TOKEN` (scoped PAT with project_admin_write).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? "";
  const projectRef = supabaseProjectRefFromUrl(supabaseUrl);

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ ok: false, skipped: true, reason: "missing Supabase URL or anon key" });
  }

  const probe = await probeSupabaseInstanceApi({ supabaseUrl, anonKey });
  let projectStatus: string | null = null;
  if (accessToken && projectRef && probe.kind === "unreachable") {
    try {
      projectStatus = await fetchSupabaseProjectStatus({ projectRef, accessToken });
    } catch {
      projectStatus = null;
    }
  }

  const decision = decideSupabaseAutoRestart({
    hasManagementToken: Boolean(accessToken),
    projectRef,
    probe,
    projectStatus,
  });

  let restarted = false;
  let restartDetail: string | undefined;
  if (decision.action === "restart" && projectRef && accessToken) {
    const result = await restartSupabaseProject({ projectRef, accessToken });
    restarted = result.ok;
    restartDetail = result.detail;
    await sendSupabaseUnhealthyRestartAlert({
      action: "restart",
      reason: decision.reason,
      projectRef,
      projectStatus,
      restarted,
      restartDetail,
    });
  }

  return NextResponse.json({
    ok: probe.kind === "ok" || restarted,
    probe,
    projectRef,
    projectStatus,
    decision,
    restarted,
    restartDetail: restartDetail ?? null,
    checkedAt: new Date().toISOString(),
  });
}

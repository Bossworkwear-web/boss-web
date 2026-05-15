import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-auth";
import { STOREFRONT_CHAT_STATUS_OPEN } from "@/lib/storefront-chat-status";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    await assertAdminSession();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const after = String(url.searchParams.get("after") ?? "").trim();

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  let query = supabase
    .from("storefront_chat_messages")
    .select("id, thread_id, created_at, storefront_chat_threads!inner(status)")
    .eq("sender", "guest")
    .eq("storefront_chat_threads.status", STOREFRONT_CHAT_STATUS_OPEN)
    .order("created_at", { ascending: true })
    .limit(30);

  if (after) {
    const parsed = Date.parse(after);
    if (!Number.isNaN(parsed)) {
      query = query.gt("created_at", new Date(parsed).toISOString());
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: "Could not load alerts" }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, alerts: data ?? [] });
}

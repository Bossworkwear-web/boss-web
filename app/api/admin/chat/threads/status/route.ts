import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-auth";
import { bumpStorefrontChatThreadUpdatedAt } from "@/lib/storefront-chat-db";
import {
  STOREFRONT_CHAT_CLOSED_MESSAGE,
  STOREFRONT_CHAT_REOPENED_MESSAGE,
  STOREFRONT_CHAT_STATUS_CLOSED,
  STOREFRONT_CHAT_STATUS_OPEN,
  STOREFRONT_CHAT_SYSTEM_STAFF_ID,
} from "@/lib/storefront-chat-status";
import { createSupabaseAdminClient } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

export async function POST(request: Request) {
  try {
    await assertAdminSession();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { threadId?: string; status?: string };
  try {
    body = (await request.json()) as { threadId?: string; status?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const threadId = String(body.threadId ?? "").trim();
  const status = String(body.status ?? "").trim().toLowerCase();

  if (!isUuid(threadId)) {
    return NextResponse.json({ ok: false, error: "Invalid thread" }, { status: 400 });
  }
  if (status !== STOREFRONT_CHAT_STATUS_OPEN && status !== STOREFRONT_CHAT_STATUS_CLOSED) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  const { data: thread, error: findErr } = await supabase
    .from("storefront_chat_threads")
    .select("id, status")
    .eq("id", threadId)
    .maybeSingle();

  if (findErr || !thread?.id) {
    return NextResponse.json({ ok: false, error: "Thread not found" }, { status: 404 });
  }

  const previous = (thread.status ?? "").trim().toLowerCase();
  if (previous === status) {
    return NextResponse.json({ ok: true as const, status, unchanged: true as const });
  }

  const { error: updErr } = await supabase
    .from("storefront_chat_threads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", threadId);

  if (updErr) {
    return NextResponse.json({ ok: false, error: "Could not update thread" }, { status: 500 });
  }

  const systemBody =
    status === STOREFRONT_CHAT_STATUS_CLOSED ? STOREFRONT_CHAT_CLOSED_MESSAGE : STOREFRONT_CHAT_REOPENED_MESSAGE;

  const { error: msgErr } = await supabase.from("storefront_chat_messages").insert({
    thread_id: threadId,
    sender: "staff",
    body: systemBody,
    staff_identifier: STOREFRONT_CHAT_SYSTEM_STAFF_ID,
  });

  if (msgErr) {
    return NextResponse.json({ ok: false, error: "Status updated but system message failed" }, { status: 500 });
  }

  await bumpStorefrontChatThreadUpdatedAt(supabase, threadId);

  return NextResponse.json({ ok: true as const, status });
}

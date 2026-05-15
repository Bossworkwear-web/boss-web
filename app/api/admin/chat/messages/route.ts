import { NextResponse } from "next/server";

import { assertAdminSession, getAdminUser } from "@/lib/admin-auth";
import { bumpStorefrontChatThreadUpdatedAt } from "@/lib/storefront-chat-db";
import { isStorefrontChatThreadClosed } from "@/lib/storefront-chat-status";
import { createSupabaseAdminClient } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 4000;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

export async function GET(request: Request) {
  try {
    await assertAdminSession();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const threadId = String(url.searchParams.get("threadId") ?? "").trim();
  if (!isUuid(threadId)) {
    return NextResponse.json({ ok: false, error: "Invalid thread" }, { status: 400 });
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  const { data: messages, error } = await supabase
    .from("storefront_chat_messages")
    .select("id, sender, body, created_at, staff_identifier")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, error: "Could not load messages" }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, messages: messages ?? [] });
}

export async function POST(request: Request) {
  try {
    await assertAdminSession();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { threadId?: string; body?: string };
  try {
    body = (await request.json()) as { threadId?: string; body?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const threadId = String(body.threadId ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!isUuid(threadId)) {
    return NextResponse.json({ ok: false, error: "Invalid thread" }, { status: 400 });
  }
  if (!text.length) {
    return NextResponse.json({ ok: false, error: "Message is empty" }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "Message is too long" }, { status: 400 });
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  const { data: thread, error: tErr } = await supabase
    .from("storefront_chat_threads")
    .select("id, status")
    .eq("id", threadId)
    .maybeSingle();

  if (tErr || !thread?.id) {
    return NextResponse.json({ ok: false, error: "Thread not found" }, { status: 404 });
  }

  if (isStorefrontChatThreadClosed(thread.status)) {
    return NextResponse.json(
      { ok: false, error: "This conversation is closed. Reopen it before replying." },
      { status: 409 },
    );
  }

  const staffId = (await getAdminUser()) ?? "admin";

  const { error: insErr } = await supabase.from("storefront_chat_messages").insert({
    thread_id: threadId,
    sender: "staff",
    body: text,
    staff_identifier: staffId,
  });

  if (insErr) {
    return NextResponse.json({ ok: false, error: "Could not send message" }, { status: 500 });
  }

  await bumpStorefrontChatThreadUpdatedAt(supabase, threadId);

  return NextResponse.json({ ok: true as const });
}

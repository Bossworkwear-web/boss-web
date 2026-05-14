import { NextResponse } from "next/server";

import { bumpStorefrontChatThreadUpdatedAt } from "@/lib/storefront-chat-db";
import { requireStorefrontCustomerEmail } from "@/lib/storefront-chat-customer-session";
import { isValidStorefrontChatVisitorKey } from "@/lib/storefront-chat-visitor-key";
import { createSupabaseAdminClient } from "@/lib/supabase";

const MAX_BODY = 4000;

export async function GET(request: Request) {
  const session = await requireStorefrontCustomerEmail();
  if (!session.ok) {
    return session.response;
  }
  const emailNorm = session.emailNorm;

  const url = new URL(request.url);
  const visitorKey = String(url.searchParams.get("visitorKey") ?? "").trim();
  if (!isValidStorefrontChatVisitorKey(visitorKey)) {
    return NextResponse.json({ ok: false, error: "Invalid visitor key" }, { status: 400 });
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Chat is temporarily unavailable" }, { status: 503 });
  }

  const { data: thread, error: tErr } = await supabase
    .from("storefront_chat_threads")
    .select("id")
    .eq("visitor_key", visitorKey)
    .eq("customer_email", emailNorm)
    .maybeSingle();

  if (tErr) {
    return NextResponse.json({ ok: false, error: "Could not load chat" }, { status: 500 });
  }
  if (!thread?.id) {
    return NextResponse.json({ ok: true as const, threadId: null as string | null, messages: [] as const });
  }

  const { data: messages, error: mErr } = await supabase
    .from("storefront_chat_messages")
    .select("id, sender, body, created_at, staff_identifier")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (mErr) {
    return NextResponse.json({ ok: false, error: "Could not load messages" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true as const,
    threadId: thread.id,
    messages: messages ?? [],
  });
}

export async function POST(request: Request) {
  const session = await requireStorefrontCustomerEmail();
  if (!session.ok) {
    return session.response;
  }
  const emailNorm = session.emailNorm;

  let body: { visitorKey?: string; body?: string };
  try {
    body = (await request.json()) as { visitorKey?: string; body?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const visitorKey = String(body.visitorKey ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!isValidStorefrontChatVisitorKey(visitorKey)) {
    return NextResponse.json({ ok: false, error: "Invalid visitor key" }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "Chat is temporarily unavailable" }, { status: 503 });
  }

  const { data: thread, error: tErr } = await supabase
    .from("storefront_chat_threads")
    .select("id")
    .eq("visitor_key", visitorKey)
    .eq("customer_email", emailNorm)
    .maybeSingle();

  if (tErr || !thread?.id) {
    return NextResponse.json({ ok: false, error: "Open the chat first" }, { status: 400 });
  }

  const { error: insErr } = await supabase.from("storefront_chat_messages").insert({
    thread_id: thread.id,
    sender: "guest",
    body: text,
    staff_identifier: null,
  });

  if (insErr) {
    return NextResponse.json({ ok: false, error: "Could not send message" }, { status: 500 });
  }

  await bumpStorefrontChatThreadUpdatedAt(supabase, thread.id);

  return NextResponse.json({ ok: true as const });
}

import { NextResponse } from "next/server";

import { bumpStorefrontChatThreadUpdatedAt } from "@/lib/storefront-chat-db";
import { requireStorefrontCustomerEmail } from "@/lib/storefront-chat-customer-session";
import {
  STOREFRONT_CHAT_REOPENED_MESSAGE,
  STOREFRONT_CHAT_STATUS_OPEN,
  STOREFRONT_CHAT_SYSTEM_STAFF_ID,
  isStorefrontChatThreadClosed,
} from "@/lib/storefront-chat-status";
import { isValidStorefrontChatVisitorKey } from "@/lib/storefront-chat-visitor-key";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await requireStorefrontCustomerEmail();
  if (!session.ok) {
    return session.response;
  }
  const emailNorm = session.emailNorm;

  let body: { visitorKey?: string };
  try {
    body = (await request.json()) as { visitorKey?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const visitorKey = String(body.visitorKey ?? "").trim();
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
    .select("id, status")
    .eq("visitor_key", visitorKey)
    .eq("customer_email", emailNorm)
    .maybeSingle();

  if (tErr) {
    return NextResponse.json({ ok: false, error: "Could not load chat" }, { status: 500 });
  }
  if (!thread?.id) {
    return NextResponse.json({ ok: false, error: "No conversation found" }, { status: 404 });
  }
  if (!isStorefrontChatThreadClosed(thread.status)) {
    return NextResponse.json({ ok: true as const, threadStatus: STOREFRONT_CHAT_STATUS_OPEN });
  }

  const { error: updErr } = await supabase
    .from("storefront_chat_threads")
    .update({ status: STOREFRONT_CHAT_STATUS_OPEN, updated_at: new Date().toISOString() })
    .eq("id", thread.id);

  if (updErr) {
    return NextResponse.json({ ok: false, error: "Could not reopen chat" }, { status: 500 });
  }

  await supabase.from("storefront_chat_messages").insert({
    thread_id: thread.id,
    sender: "staff",
    body: STOREFRONT_CHAT_REOPENED_MESSAGE,
    staff_identifier: STOREFRONT_CHAT_SYSTEM_STAFF_ID,
  });

  await bumpStorefrontChatThreadUpdatedAt(supabase, thread.id);

  return NextResponse.json({ ok: true as const, threadStatus: STOREFRONT_CHAT_STATUS_OPEN });
}

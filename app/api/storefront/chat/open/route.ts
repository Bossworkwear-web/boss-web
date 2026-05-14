import { NextResponse } from "next/server";

import { requireStorefrontCustomerEmail } from "@/lib/storefront-chat-customer-session";
import { isValidStorefrontChatVisitorKey } from "@/lib/storefront-chat-visitor-key";
import { createSupabaseAdminClient } from "@/lib/supabase";

const MAX_NAME = 120;
const MAX_EMAIL = 254;

export async function POST(request: Request) {
  const session = await requireStorefrontCustomerEmail();
  if (!session.ok) {
    return session.response;
  }
  const emailNorm = session.emailNorm;

  let body: { visitorKey?: string; visitorName?: string; visitorEmail?: string };
  try {
    body = (await request.json()) as { visitorKey?: string; visitorName?: string; visitorEmail?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const visitorKey = String(body.visitorKey ?? "").trim();
  if (!isValidStorefrontChatVisitorKey(visitorKey)) {
    return NextResponse.json({ ok: false, error: "Invalid visitor key" }, { status: 400 });
  }

  const visitorName = String(body.visitorName ?? "").trim().slice(0, MAX_NAME) || null;
  const visitorEmailOptional = String(body.visitorEmail ?? "").trim().slice(0, MAX_EMAIL) || null;
  const visitorEmail = visitorEmailOptional ?? emailNorm;

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Chat is temporarily unavailable" }, { status: 503 });
  }

  const { data: existing, error: findErr } = await supabase
    .from("storefront_chat_threads")
    .select("id, visitor_name, visitor_email")
    .eq("visitor_key", visitorKey)
    .eq("customer_email", emailNorm)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ ok: false, error: "Could not open chat" }, { status: 500 });
  }

  if (existing?.id) {
    const patch: {
      visitor_name?: string | null;
      visitor_email?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
      visitor_email: visitorEmail,
    };
    if (visitorName) {
      patch.visitor_name = visitorName;
    }
    await supabase.from("storefront_chat_threads").update(patch).eq("id", existing.id);
    return NextResponse.json({ ok: true as const, threadId: existing.id });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("storefront_chat_threads")
    .insert({
      visitor_key: visitorKey,
      customer_email: emailNorm,
      visitor_name: visitorName,
      visitor_email: visitorEmail,
    })
    .select("id")
    .maybeSingle();

  if (insErr || !inserted?.id) {
    return NextResponse.json({ ok: false, error: "Could not start chat" }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, threadId: inserted.id });
}

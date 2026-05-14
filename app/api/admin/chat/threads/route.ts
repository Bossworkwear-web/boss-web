import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    await assertAdminSession();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  const { data: threads, error } = await supabase
    .from("storefront_chat_threads")
    .select("id, visitor_key, customer_email, visitor_name, visitor_email, status, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(150);

  if (error) {
    const missing =
      error.message?.includes("storefront_chat_threads") || error.code === "42P01"
        ? "Run the storefront chat migration (storefront_chat_threads) in Supabase."
        : error.message;
    return NextResponse.json({ ok: false, error: missing }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, threads: threads ?? [] });
}

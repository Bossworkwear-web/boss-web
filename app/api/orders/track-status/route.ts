import { NextResponse } from "next/server";

import type { OrderTrackDeliveryPayload } from "@/lib/order-track-delivery";
import { createSupabaseAdminClient } from "@/lib/supabase";

const TOKEN_RE = /^[0-9a-f-]{36}$/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("store_orders")
    .select("status, created_at, shipped_at, tracking_number, carrier")
    .eq("tracking_token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const payload: OrderTrackDeliveryPayload = {
    status: data.status,
    created_at: data.created_at,
    shipped_at: data.shipped_at ?? null,
    tracking_number: data.tracking_number ?? null,
    carrier: data.carrier ?? "Australia Post",
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

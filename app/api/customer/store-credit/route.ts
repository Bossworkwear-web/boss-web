import { cookies } from "next/headers";

import { getCustomerStoreCreditBalanceCents } from "@/lib/customer-store-credit";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  const cookieStore = await cookies();
  const customerEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  if (!customerEmail) {
    return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const balanceCents = await getCustomerStoreCreditBalanceCents(supabase, customerEmail);
    return Response.json({ ok: true, balanceCents });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load store credit.";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { clearLegacyCustomerCookies } from "@/lib/customer-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await clearLegacyCustomerCookies();
  return NextResponse.json({ ok: true });
}

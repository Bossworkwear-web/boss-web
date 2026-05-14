import { cookies } from "next/headers";

import { hasPriorEmbroideryOrderForCustomerEmail } from "@/lib/storefront-prior-embroidery-order";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  const cookieStore = await cookies();
  const email = (cookieStore.get("customer_email")?.value ?? "").trim();
  if (!email) {
    return Response.json({ hasPriorEmbroideryOrder: false });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const hasPrior = await hasPriorEmbroideryOrderForCustomerEmail(supabase, email);
    return Response.json({ hasPriorEmbroideryOrder: hasPrior });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

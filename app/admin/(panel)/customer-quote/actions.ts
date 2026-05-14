"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

function isUuid(raw: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.trim());
}

/** Remove a row from `quote_requests` (Customer Quote list + CRM). Admin only. */
export async function deleteQuoteRequest(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const id = String(formData.get("quote_id") ?? "").trim();
  if (!isUuid(id)) {
    redirect("/admin/customer-quote?error=invalid_quote_id");
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    redirect("/admin/customer-quote?error=db_unavailable");
  }

  const { error } = await supabase.from("quote_requests").delete().eq("id", id);

  if (error) {
    const msg = error.message.length > 400 ? `${error.message.slice(0, 400)}…` : error.message;
    redirect(`/admin/customer-quote?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/admin/customer-quote");
  revalidatePath("/admin/crm");
  redirect("/admin/customer-quote?deleted=1");
}

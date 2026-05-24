"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase";
import { applyCustomerPasswordChange } from "@/lib/customer-password-update";

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export async function submitPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const confirm = String(formData.get("confirm_password") ?? "").trim();

  if (!email || !token || !password || !confirm || password !== confirm) {
    redirect("/reset-password?status=invalid");
  }

  const tokenHash = sha256Hex(token);
  const supabase = createSupabaseAdminClient();

  // NOTE: `customer_password_resets` exists via migration, but generated Supabase types may lag behind.
  const { data: resetRow, error: resetErr } = await supabase
    .from("customer_password_resets" as never)
    .select("id, customer_profile_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const reset = resetRow as
    | {
        id: string;
        customer_profile_id: string;
        expires_at: string;
        used_at: string | null;
      }
    | null;

  if (resetErr || !reset?.id || reset.used_at) {
    redirect("/reset-password?status=invalid");
  }

  const expiresAt = new Date(String(reset.expires_at));
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    redirect("/reset-password?status=invalid");
  }

  const { data: profile, error: profErr } = await supabase
    .from("customer_profiles")
    .select("id, email_address, auth_user_id")
    .eq("id", reset.customer_profile_id)
    .maybeSingle();

  if (profErr || !profile?.id || String(profile.email_address ?? "").trim().toLowerCase() !== email) {
    redirect("/reset-password?status=invalid");
  }

  const pwRes = await applyCustomerPasswordChange(
    {
      id: profile.id,
      email_address: String(profile.email_address),
      auth_user_id: profile.auth_user_id,
    },
    password,
  );
  if (!pwRes.ok) {
    redirect("/reset-password?status=invalid");
  }

  await supabase
    .from("customer_password_resets" as never)
    .update({ used_at: new Date().toISOString() } as never)
    .eq("id", reset.id);

  redirect("/log-in?status=reset_sent");
}


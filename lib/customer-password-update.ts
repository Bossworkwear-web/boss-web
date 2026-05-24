import { findAuthUserByEmail, linkProfileToAuthUser } from "@/lib/customer-auth";
import {
  hashCustomerPassword,
  isCustomerPasswordHash,
  verifyCustomerPassword,
} from "@/lib/customer-password-hash";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CustomerPasswordProfileRef = {
  id: string;
  email_address: string;
  auth_user_id: string | null;
  login_password?: string | null;
};

/** Verify current password via Supabase Auth or legacy stored value (plain/hash). */
export async function verifyCustomerCurrentPassword(
  profile: Pick<CustomerPasswordProfileRef, "auth_user_id" | "login_password">,
  emailNorm: string,
  currentPassword: string,
): Promise<boolean> {
  if (profile.auth_user_id) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password: currentPassword,
    });
    return !error;
  }

  return verifyCustomerPassword(currentPassword, profile.login_password);
}

/**
 * Store password in Supabase Auth when possible; legacy-only rows get a scrypt hash (never plain text).
 * Clears login_password once an auth user is linked.
 */
export async function applyCustomerPasswordChange(
  profile: CustomerPasswordProfileRef,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const password = newPassword.trim();
  if (password.length < 6) {
    return { ok: false, error: "Password is too short." };
  }

  const emailNorm = profile.email_address.trim().toLowerCase();
  const admin = createSupabaseAdminClient();
  let authUserId = profile.auth_user_id?.trim() || null;

  if (!authUserId) {
    const existingAuth = await findAuthUserByEmail(emailNorm);
    if (existingAuth) {
      authUserId = existingAuth.id;
    }
  }

  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, { password });
    if (error) {
      return { ok: false, error: error.message };
    }
    await admin
      .from("customer_profiles")
      .update({ login_password: null, auth_user_id: authUserId })
      .eq("id", profile.id);
    return { ok: true };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailNorm,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    const hashed = hashCustomerPassword(password);
    const { error: hashErr } = await admin
      .from("customer_profiles")
      .update({ login_password: hashed })
      .eq("id", profile.id);
    if (hashErr) {
      return { ok: false, error: createErr?.message ?? hashErr.message };
    }
    return { ok: true };
  }

  await linkProfileToAuthUser(profile.id, created.user.id);
  await admin.from("customer_profiles").update({ login_password: null, auth_user_id: created.user.id }).eq("id", profile.id);
  return { ok: true };
}

export function customerSignInStatus(profile: {
  auth_user_id: string | null;
  login_password: string | null;
}): "supabase_auth" | "legacy_hashed" | "legacy_plain" | "oauth_only" {
  if (profile.auth_user_id) {
    return "supabase_auth";
  }
  const stored = profile.login_password?.trim() ?? "";
  if (!stored) {
    return "oauth_only";
  }
  if (isCustomerPasswordHash(stored)) {
    return "legacy_hashed";
  }
  return "legacy_plain";
}

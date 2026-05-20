import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CustomerProfileRow = {
  id: string;
  customer_name: string;
  organisation: string;
  contact_number: string;
  email_address: string;
  login_password: string | null;
  delivery_address: string;
  billing_address: string;
  auth_user_id: string | null;
};

const LEGACY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions() {
  return {
    path: "/" as const,
    maxAge: LEGACY_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Keeps existing cart/checkout code working while Supabase Auth is the source of truth. */
export async function syncLegacyCustomerCookies(profile: {
  customer_name: string;
  email_address: string;
  delivery_address: string;
}) {
  const cookieStore = await cookies();
  cookieStore.set("customer_name", profile.customer_name, cookieOptions());
  cookieStore.set("customer_email", profile.email_address.trim().toLowerCase(), cookieOptions());
  cookieStore.set("customer_delivery_address", profile.delivery_address ?? "", cookieOptions());
}

export async function clearLegacyCustomerCookies() {
  const cookieStore = await cookies();
  const clear = { path: "/", maxAge: 0, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
  cookieStore.set("customer_name", "", clear);
  cookieStore.set("customer_email", "", clear);
  cookieStore.set("customer_delivery_address", "", clear);
  cookieStore.set("customer_oauth_pending", "", clear);
  cookieStore.set("customer_oauth_email", "", clear);
  cookieStore.set("pending_signup_password", "", clear);
}

export function isProfileComplete(profile: CustomerProfileRow): boolean {
  return Boolean(
    profile.customer_name?.trim() &&
      profile.organisation?.trim() &&
      profile.contact_number?.trim() &&
      profile.delivery_address?.trim() &&
      profile.billing_address?.trim(),
  );
}

const profileSelect =
  "id, customer_name, organisation, contact_number, email_address, login_password, delivery_address, billing_address, auth_user_id";

export async function getCustomerProfileByEmail(emailNorm: string) {
  const supabase = createSupabaseAdminClient();

  const { data: exact, error: exactErr } = await supabase
    .from("customer_profiles")
    .select(profileSelect)
    .eq("email_address", emailNorm)
    .maybeSingle();

  if (exactErr) {
    return { profile: null, error: exactErr.message };
  }
  if (exact) {
    return { profile: exact as CustomerProfileRow, error: null };
  }

  const { data: loose, error: looseErr } = await supabase
    .from("customer_profiles")
    .select(profileSelect)
    .ilike("email_address", emailNorm)
    .maybeSingle();

  if (looseErr) {
    return { profile: null, error: looseErr.message };
  }
  return { profile: (loose as CustomerProfileRow | null) ?? null, error: null };
}

/** Lookup Supabase Auth user by email via admin generate_link (no listUsers pagination). */
export async function findAuthUserByEmail(emailNorm: string): Promise<User | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: emailNorm,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("not found") ||
      msg.includes("no user") ||
      msg.includes("does not exist") ||
      msg.includes("unable to find")
    ) {
      return null;
    }
    console.error("[findAuthUserByEmail]", error.message);
    return null;
  }

  return data.user ?? null;
}

/** Send Supabase Auth password-reset email when the user exists in auth.users. */
export async function sendSupabasePasswordResetEmail(
  emailNorm: string,
  redirectTo: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(emailNorm, {
    redirectTo,
  });
  if (error) {
    console.error("[sendSupabasePasswordResetEmail]", error.message);
    return false;
  }
  return true;
}

export type CustomerAccountSnapshot = {
  profile: CustomerProfileRow | null;
  authUser: User | null;
};

export async function getCustomerAccountSnapshot(emailNorm: string): Promise<CustomerAccountSnapshot> {
  const [{ profile }, authUser] = await Promise.all([
    getCustomerProfileByEmail(emailNorm),
    findAuthUserByEmail(emailNorm),
  ]);
  return { profile, authUser };
}

export async function getCustomerProfileByAuthUserId(authUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select(
      "id, customer_name, organisation, contact_number, email_address, login_password, delivery_address, billing_address, auth_user_id",
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    return { profile: null, error: error.message };
  }
  return { profile: data as CustomerProfileRow | null, error: null };
}

export async function linkProfileToAuthUser(profileId: string, authUserId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("customer_profiles").update({ auth_user_id: authUserId }).eq("id", profileId);
}

export async function setOAuthPendingCookies(emailNorm: string) {
  const cookieStore = await cookies();
  cookieStore.set("customer_oauth_pending", "1", cookieOptions());
  cookieStore.set("customer_oauth_email", emailNorm, cookieOptions());
}

/**
 * After OAuth or email Auth sign-in: link profile, sync legacy cookies, or flag profile completion.
 */
export async function finalizeCustomerAuthSession(user: User): Promise<
  | { status: "ready"; profile: CustomerProfileRow }
  | { status: "needs_profile"; email: string; fullName: string }
> {
  const emailNorm = user.email?.trim().toLowerCase() ?? "";
  if (!emailNorm) {
    throw new Error("Signed-in account has no email");
  }

  let profile: CustomerProfileRow | null = null;

  const byAuth = await getCustomerProfileByAuthUserId(user.id);
  profile = byAuth.profile;

  if (!profile) {
    const byEmail = await getCustomerProfileByEmail(emailNorm);
    profile = byEmail.profile;
    if (profile && profile.auth_user_id !== user.id) {
      await linkProfileToAuthUser(profile.id, user.id);
      profile = { ...profile, auth_user_id: user.id };
    }
  }

  if (profile && isProfileComplete(profile)) {
    await syncLegacyCustomerCookies(profile);
    return { status: "ready", profile };
  }

  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.customer_name === "string" && meta.customer_name.trim()) ||
    "";

  await setOAuthPendingCookies(emailNorm);
  return { status: "needs_profile", email: emailNorm, fullName };
}

/**
 * Legacy email/password in customer_profiles → create Supabase Auth user and link.
 */
/**
 * Link a legacy customer_profiles row to Supabase Auth using the given password.
 * When login_password is empty (e.g. admin-created row), the supplied password is stored.
 */
export async function migrateLegacyPasswordToAuth(emailNorm: string, password: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { profile } = await getCustomerProfileByEmail(emailNorm);
  if (!profile) {
    return false;
  }

  const storedPw = profile.login_password?.trim() ?? "";
  if (storedPw && storedPw !== password) {
    return false;
  }

  if (!storedPw) {
    await admin.from("customer_profiles").update({ login_password: password }).eq("id", profile.id);
  }

  if (profile.auth_user_id) {
    const { error } = await admin.auth.admin.updateUserById(profile.auth_user_id, { password });
    return !error;
  }

  const existingAuth = await findAuthUserByEmail(emailNorm);
  if (existingAuth) {
    const { error: linkErr } = await admin.auth.admin.updateUserById(existingAuth.id, { password });
    if (linkErr) {
      return false;
    }
    await linkProfileToAuthUser(profile.id, existingAuth.id);
    return true;
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailNorm,
    password,
    email_confirm: true,
    user_metadata: { customer_name: profile.customer_name },
  });

  if (createErr || !created.user) {
    return false;
  }

  await linkProfileToAuthUser(profile.id, created.user.id);
  return true;
}

/** Auth user exists but customer_profiles is missing — create profile shell after email sign-up. */
export async function linkAuthUserToNewProfileFromSignup(
  authUser: User,
  fullName: string,
  emailNorm: string,
  password: string,
): Promise<CustomerProfileRow | null> {
  const admin = createSupabaseAdminClient();
  const { data: inserted, error } = await admin
    .from("customer_profiles")
    .insert({
      customer_name: fullName,
      organisation: "",
      contact_number: "",
      email_address: emailNorm,
      login_password: password,
      delivery_address: "",
      billing_address: "",
      auth_user_id: authUser.id,
    })
    .select(
      "id, customer_name, organisation, contact_number, email_address, login_password, delivery_address, billing_address, auth_user_id",
    )
    .single();

  if (error || !inserted) {
    return null;
  }
  return inserted as CustomerProfileRow;
}

export async function getAuthenticatedCustomerUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export type OAuthProvider = "google" | "azure" | "apple";

import { cookies } from "next/headers";

import {
  findAuthUserByEmail,
  getCustomerProfileByEmail,
  isProfileComplete,
  syncLegacyCustomerCookies,
  type CustomerProfileRow,
} from "@/lib/customer-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LEGACY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function legacyCookieOptions() {
  return {
    path: "/" as const,
    maxAge: LEGACY_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

async function verifyMagicLinkSession(emailNorm: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: emailNorm,
  });

  const tokenHash = linkData?.properties?.hashed_token?.trim();
  if (linkError || !tokenHash) {
    console.error("[admin-customer-impersonation] generateLink:", linkError?.message ?? "missing token");
    return false;
  }

  const supabase = await createSupabaseServerClient();
  const attempts: Array<"email" | "magiclink"> = ["email", "magiclink"];
  for (const type of attempts) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!verifyError) {
      return true;
    }
    console.error(`[admin-customer-impersonation] verifyOtp (${type}):`, verifyError.message);
  }
  return false;
}

function customerDetailsRedirect(profile: Pick<CustomerProfileRow, "email_address" | "customer_name">) {
  const qs = new URLSearchParams({
    email: profile.email_address,
    ...(profile.customer_name?.trim() ? { full_name: profile.customer_name.trim() } : {}),
  });
  return `/customer-details?${qs.toString()}`;
}

async function setOrdersOnlyLegacyCookies(emailNorm: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseAdminClient();
  const { data: order } = await supabase
    .from("store_orders")
    .select("customer_name")
    .ilike("customer_email", emailNorm)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order) {
    return { ok: false, error: "No customer account or orders found for this email." };
  }

  const cookieStore = await cookies();
  const opts = legacyCookieOptions();
  cookieStore.set("customer_email", emailNorm, opts);
  cookieStore.set("customer_name", String(order.customer_name ?? "").trim(), opts);
  cookieStore.set("customer_delivery_address", "", opts);
  return { ok: true };
}

export async function establishAdminCustomerSession(
  emailRaw: string,
): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const emailNorm = emailRaw.trim().toLowerCase();
  if (!emailNorm) {
    return { ok: false, error: "Email is required." };
  }

  const [{ profile }, authUser] = await Promise.all([
    getCustomerProfileByEmail(emailNorm),
    findAuthUserByEmail(emailNorm),
  ]);

  if (!profile && !authUser) {
    const ordersOnly = await setOrdersOnlyLegacyCookies(emailNorm);
    if (!ordersOnly.ok) {
      return ordersOnly;
    }
    return { ok: true, redirectTo: "/customer" };
  }

  if (authUser) {
    const authEmail = authUser.email?.trim().toLowerCase() || emailNorm;
    await verifyMagicLinkSession(authEmail);
  }

  if (profile) {
    await syncLegacyCustomerCookies(profile);
    if (isProfileComplete(profile)) {
      return { ok: true, redirectTo: "/customer" };
    }
    return { ok: true, redirectTo: customerDetailsRedirect(profile) };
  }

  const cookieStore = await cookies();
  const opts = legacyCookieOptions();
  const meta = authUser?.user_metadata ?? {};
  const customerName =
    (typeof meta.customer_name === "string" && meta.customer_name.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    "";

  cookieStore.set("customer_email", emailNorm, opts);
  cookieStore.set("customer_name", customerName, opts);
  cookieStore.set("customer_delivery_address", "", opts);

  return {
    ok: true,
    redirectTo: customerDetailsRedirect({
      email_address: emailNorm,
      customer_name: customerName,
    }),
  };
}

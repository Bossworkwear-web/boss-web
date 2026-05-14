"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sendCustomerPasswordResetEmail } from "@/lib/customer-password-reset-email";
import { createSupabaseAdminClient } from "@/lib/supabase";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.includes("NEXT_REDIRECT")
  );
}

function signupErrorRedirect(status: string) {
  const qs = new URLSearchParams({
    mode: "signup",
    status,
  });
  redirect(`/log-in?${qs.toString()}`);
}

/** ISSUE:customer-password-reset — add recovery/token verification when implementing automated reset (AGENTS.md). */
export async function submitLogIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect(`/log-in?status=invalid`);
  }

  const emailNorm = email.trim().toLowerCase();

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("customer_name, email_address, login_password, delivery_address")
      .eq("email_address", emailNorm)
      .maybeSingle();

    if (error || !data) {
      redirect(`/log-in?status=mismatch`);
    }

    const stored = data.login_password;
    if (stored === null || stored === "") {
      redirect(`/log-in?status=mismatch`);
    }

    if (stored !== password) {
      redirect(`/log-in?status=mismatch`);
    }

    const cookieStore = await cookies();
    cookieStore.set("customer_name", data.customer_name, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.set("customer_email", data.email_address, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.set("customer_delivery_address", data.delivery_address ?? "", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    redirect(`/log-in?status=error`);
  }

  redirect("/");
}

export async function submitSignUp(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const confirmPassword = String(formData.get("confirm_password") ?? "").trim();

  if (!fullName || !email || !password || !confirmPassword) {
    signupErrorRedirect("invalid");
  }

  if (password !== confirmPassword) {
    signupErrorRedirect("password_mismatch");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: existingProfile, error } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("email_address", email)
      .maybeSingle();

    if (error) {
      signupErrorRedirect("error");
    }

    if (existingProfile) {
      signupErrorRedirect("email_exists");
    }

    const cookieStore = await cookies();
    cookieStore.set("pending_signup_password", password, {
      path: "/",
      maxAge: 60 * 20,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    signupErrorRedirect("error");
  }

  redirect(
    `/customer-details?full_name=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}`
  );
}

export async function requestTemporaryPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/log-in?status=reset_invalid");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("customer_profiles")
      .select("id, customer_name, email_address, login_password")
      .eq("email_address", email)
      .maybeSingle();

    if (!data?.id) {
      redirect(`/log-in?status=reset_not_found`);
    }

    if (!process.env.RESEND_API_KEY?.trim()) {
      console.error("[requestTemporaryPassword] RESEND_API_KEY is not set");
      redirect(`/log-in?status=reset_email_config`);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    // NOTE: `customer_password_resets` exists via migration, but generated Supabase types may lag behind.
    const { error: insErr } = await supabase.from("customer_password_resets" as never).insert({
      customer_profile_id: data.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    } as never);
    if (insErr) {
      console.error("[requestTemporaryPassword] Could not insert reset token:", insErr.message);
      redirect(`/log-in?status=reset_error`);
    }

    const site =
      process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}` : "http://localhost:3000");
    const resetUrl = `${site}/reset-password?email=${encodeURIComponent(data.email_address)}&token=${encodeURIComponent(token)}`;

    const sent = await sendCustomerPasswordResetEmail({
      to: data.email_address,
      customerName: data.customer_name,
      resetUrl,
    });
    if (!sent.ok) {
      console.error("[requestTemporaryPassword] Email send failed:", sent.error);
      redirect(`/log-in?status=reset_email_error`);
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    redirect(`/log-in?status=reset_error`);
  }

  redirect(`/log-in?status=reset_sent`);
}

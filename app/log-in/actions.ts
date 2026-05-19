"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  finalizeCustomerAuthSession,
  getCustomerProfileByEmail,
  migrateLegacyPasswordToAuth,
  syncLegacyCustomerCookies,
} from "@/lib/customer-auth";
import { isRecaptchaConfigured, verifyRecaptchaToken } from "@/lib/recaptcha";
import { sendCustomerPasswordResetEmail } from "@/lib/customer-password-reset-email";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function submitLogIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect(`/log-in?status=invalid`);
  }

  const emailNorm = email.trim().toLowerCase();

  try {
    const supabase = await createSupabaseServerClient();
    let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password,
    });

    if (signInError) {
      const migrated = await migrateLegacyPasswordToAuth(emailNorm, password);
      if (migrated) {
        const retry = await supabase.auth.signInWithPassword({ email: emailNorm, password });
        signInData = retry.data;
        signInError = retry.error;
      }
    }

    if (signInError || !signInData.user) {
      redirect(`/log-in?status=mismatch`);
    }

    const result = await finalizeCustomerAuthSession(signInData.user);
    if (result.status === "needs_profile") {
      redirect(
        `/customer-details?email=${encodeURIComponent(result.email)}&full_name=${encodeURIComponent(result.fullName)}`,
      );
    }
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

  if (isRecaptchaConfigured()) {
    const token = String(formData.get("g-recaptcha-response") ?? "").trim();
    const ok = await verifyRecaptchaToken(token);
    if (!ok) {
      signupErrorRedirect("recaptcha_failed");
    }
  } else if (process.env.NODE_ENV === "production") {
    signupErrorRedirect("recaptcha_config");
  }

  try {
    const { profile: existingProfile } = await getCustomerProfileByEmail(email);
    if (existingProfile) {
      signupErrorRedirect("email_exists");
    }

    const supabase = await createSupabaseServerClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, customer_name: fullName },
      },
    });

    if (signUpError) {
      const msg = signUpError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        signupErrorRedirect("email_exists");
      }
      signupErrorRedirect("error");
    }

    const cookieStore = await cookies();
    if (!signUpData.session) {
      cookieStore.set("pending_signup_password", password, {
        path: "/",
        maxAge: 60 * 20,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    } else {
      cookieStore.set("pending_signup_password", "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    signupErrorRedirect("error");
  }

  redirect(
    `/customer-details?full_name=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}`,
  );
}

/** Password reset via Resend token (legacy). Supabase Auth users can also use this until fully migrated. */
export async function requestTemporaryPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/log-in?status=reset_invalid");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("customer_profiles")
      .select("id, customer_name, email_address, login_password, auth_user_id")
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
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    const { error: insErr } = await supabase.from("customer_password_resets" as never).insert({
      customer_profile_id: data.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    } as never);
    if (insErr) {
      console.error("[requestTemporaryPassword] Could not insert reset token:", insErr.message);
      redirect(`/log-in?status=reset_error`);
    }

    const site = getSiteUrl();
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

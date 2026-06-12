"use server";

import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  completeEmailSignUp,
  finalizeCustomerAuthSession,
  findAuthUserByEmail,
  getCustomerAccountSnapshot,
  getCustomerProfileByEmail,
  migrateLegacyPasswordToAuth,
  sendSupabasePasswordResetEmail,
} from "@/lib/customer-auth";
import {
  isRecaptchaConfigured,
  isRecaptchaDevBypass,
  recaptchaFailureRedirectStatus,
  verifyRecaptchaToken,
} from "@/lib/recaptcha";
import { sendCustomerPasswordResetEmail } from "@/lib/customer-password-reset-email";
import { combineCustomerName } from "@/lib/customer-name";
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
    const account = await getCustomerAccountSnapshot(emailNorm);

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
      if (account.profile && !account.authUser) {
        redirect(`/log-in?status=legacy_account`);
      }
      if (account.authUser) {
        redirect(`/log-in?status=mismatch`);
      }
      if (account.profile) {
        redirect(`/log-in?status=mismatch`);
      }
      redirect(`/log-in?status=no_account`);
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
  const firstName = String(formData.get("first_name") ?? "").trim();
  const surname = String(formData.get("surname") ?? "").trim();
  const fullName = combineCustomerName(firstName, surname);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const confirmPassword = String(formData.get("confirm_password") ?? "").trim();

  if (!firstName || !surname || !email || !password || !confirmPassword) {
    signupErrorRedirect("invalid");
  }

  if (password !== confirmPassword) {
    signupErrorRedirect("password_mismatch");
  }

  if (isRecaptchaConfigured() && !isRecaptchaDevBypass()) {
    const token = String(
      formData.get("recaptcha_token") ?? formData.get("g-recaptcha-response") ?? "",
    ).trim();
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for");
    const remoteIp = forwardedFor?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || undefined;
    const verify = await verifyRecaptchaToken(token, remoteIp);
    if (!verify.ok) {
      signupErrorRedirect(recaptchaFailureRedirectStatus(verify.errorCodes));
    }
  } else if (process.env.NODE_ENV === "production" && !isRecaptchaConfigured()) {
    signupErrorRedirect("recaptcha_config");
  }

  try {
    const result = await completeEmailSignUp(email, password, fullName);

    switch (result.status) {
      case "email_exists":
        signupErrorRedirect("email_exists");
        break;
      case "legacy_exists":
        signupErrorRedirect("legacy_exists");
        break;
      case "weak_password":
        signupErrorRedirect("weak_password");
        break;
      case "error":
        console.error("[submitSignUp]", result.message);
        signupErrorRedirect("signup_failed");
        break;
      case "redirect_details": {
        const cookieStore = await cookies();
        const supabase = await createSupabaseServerClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
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

        redirect(
          `/customer-details?full_name=${encodeURIComponent(result.fullName)}&email=${encodeURIComponent(result.email)}`,
        );
      }
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[submitSignUp]", error);
    signupErrorRedirect("error");
  }
}

/** Password reset via Resend token (legacy). Supabase Auth users can also use this until fully migrated. */
export async function requestTemporaryPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/log-in?status=reset_invalid");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { profile } = await getCustomerProfileByEmail(email);
    const authUser = await findAuthUserByEmail(email);

    if (!profile?.id && !authUser) {
      redirect(`/log-in?status=reset_not_found`);
    }

    if (profile?.auth_user_id || authUser) {
      const site = getSiteUrl();
      const sent = await sendSupabasePasswordResetEmail(
        email,
        `${site}/auth/callback?next=/reset-password`,
      );
      if (!sent) {
        redirect(`/log-in?status=reset_error`);
      }
      redirect(`/log-in?status=reset_sent`);
    }

    const data = profile;

    if (!process.env.RESEND_API_KEY?.trim()) {
      console.error("[requestTemporaryPassword] RESEND_API_KEY is not set");
      redirect(`/log-in?status=reset_email_config`);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    const { error: insErr } = await supabase.from("customer_password_resets" as never).insert({
      customer_profile_id: data!.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    } as never);
    if (insErr) {
      console.error("[requestTemporaryPassword] Could not insert reset token:", insErr.message);
      redirect(`/log-in?status=reset_error`);
    }

    const site = getSiteUrl();
    const resetUrl = `${site}/reset-password?email=${encodeURIComponent(data!.email_address)}&token=${encodeURIComponent(token)}`;

    const sent = await sendCustomerPasswordResetEmail({
      to: data!.email_address,
      customerName: data!.customer_name,
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

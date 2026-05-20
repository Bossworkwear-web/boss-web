"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  finalizeCustomerAuthSession,
  findAuthUserByEmail,
  getCustomerAccountSnapshot,
  getCustomerProfileByEmail,
  linkAuthUserToNewProfileFromSignup,
  migrateLegacyPasswordToAuth,
  sendSupabasePasswordResetEmail,
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
    const account = await getCustomerAccountSnapshot(email);
    const { profile: existingProfile, authUser: existingAuthUser } = account;

    if (existingProfile?.auth_user_id || (existingProfile && existingAuthUser)) {
      signupErrorRedirect("email_exists");
    }

    if (existingProfile && !existingProfile.auth_user_id) {
      const migrated = await migrateLegacyPasswordToAuth(email, password);
      if (!migrated) {
        signupErrorRedirect("legacy_exists");
      }

      const supabase = await createSupabaseServerClient();
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError || !signInData.user) {
        signupErrorRedirect("legacy_exists");
      }

      const cookieStore = await cookies();
      cookieStore.set("pending_signup_password", "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      redirect(
        `/customer-details?full_name=${encodeURIComponent(existingProfile.customer_name || fullName)}&email=${encodeURIComponent(email)}`,
      );
    }

    const supabase = await createSupabaseServerClient();

    if (existingAuthUser && !existingProfile) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        signupErrorRedirect("auth_exists");
      }
      if (!signInData.user) {
        signupErrorRedirect("error");
      }

      await linkAuthUserToNewProfileFromSignup(signInData.user!, fullName, email, password);

      const cookieStore = await cookies();
      cookieStore.set("pending_signup_password", "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      redirect(
        `/customer-details?full_name=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}`,
      );
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, customer_name: fullName },
      },
    });

    if (signUpError) {
      const msg = signUpError.message.toLowerCase();
      const code = (signUpError.code ?? "").toLowerCase();
      if (
        code.includes("already") ||
        code.includes("registered") ||
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists")
      ) {
        const authNow = existingAuthUser ?? (await getCustomerAccountSnapshot(email)).authUser;
        if (authNow) {
          signupErrorRedirect("auth_exists");
        }
        signupErrorRedirect("email_exists");
      }
      console.error("[submitSignUp]", signUpError.message, signUpError.code);
      signupErrorRedirect("signup_failed");
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

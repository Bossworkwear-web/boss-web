"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sendCustomerTemporaryPasswordEmail } from "@/lib/customer-password-reset-email";
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

function signupErrorRedirect(
  status: string,
  fullName: string,
  email: string
) {
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
    signupErrorRedirect("invalid", fullName, email);
  }

  if (password !== confirmPassword) {
    signupErrorRedirect("password_mismatch", fullName, email);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: existingProfile, error } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("email_address", email)
      .maybeSingle();

    if (error) {
      signupErrorRedirect("error", fullName, email);
    }

    if (existingProfile) {
      signupErrorRedirect("email_exists", fullName, email);
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
    signupErrorRedirect("error", fullName, email);
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

    const tempPassword = `BOSS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const previousPassword = data.login_password;

    const { error: updateError } = await supabase
      .from("customer_profiles")
      .update({ login_password: tempPassword })
      .eq("id", data.id);

    if (updateError) {
      redirect(`/log-in?status=reset_error`);
    }

    const sent = await sendCustomerTemporaryPasswordEmail({
      to: data.email_address,
      customerName: data.customer_name,
      tempPassword,
    });
    if (!sent.ok) {
      console.error("[requestTemporaryPassword] Email send failed:", sent.error);
      const { error: restoreError } = await supabase
        .from("customer_profiles")
        .update({ login_password: previousPassword })
        .eq("id", data.id);
      if (restoreError) {
        console.error(
          "[requestTemporaryPassword] Could not restore previous password:",
          restoreError
        );
      }
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

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
    full_name: fullName,
    email,
  });
  redirect(`/log-in?${qs.toString()}`);
}

/** ISSUE:customer-password-reset — add recovery/token verification when implementing automated reset (AGENTS.md). */
export async function submitLogIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect(`/log-in?status=invalid&email=${encodeURIComponent(email)}`);
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
      redirect(`/log-in?status=mismatch&email=${encodeURIComponent(email)}`);
    }

    const stored = data.login_password;
    if (stored === null || stored === "") {
      redirect(`/log-in?status=oauth_only&email=${encodeURIComponent(email)}`);
    }

    if (stored !== password) {
      redirect(`/log-in?status=mismatch&email=${encodeURIComponent(email)}`);
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
    redirect(`/log-in?status=error&email=${encodeURIComponent(email)}`);
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

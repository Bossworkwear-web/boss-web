import Link from "next/link";

import { AlertTriangleIcon, ArrowLeftIcon, XCircleIcon } from "@/app/components/icons";

import { LogInFormsClient } from "./log-in-forms-client";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

type LogInPageProps = {
  searchParams: Promise<{
    mode?: string;
    status?: string;
    email?: string;
    full_name?: string;
    message?: string;
  }>;
};

export default async function LogInPage({ searchParams }: LogInPageProps) {
  const params = await searchParams;
  const isSignup = params.mode === "signup";
  const status = params.status;
  // Always render clean forms when switching tabs.

  return (
    <main className="min-h-screen bg-white py-10 text-brand-navy">
      <div className={SITE_PAGE_ROW_CLASS}>
        <div className="mx-auto w-full max-w-md space-y-6">
        <header className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[1.3125rem] font-semibold leading-snug text-brand-orange"
          >
            <ArrowLeftIcon className="h-6 w-6 shrink-0" />
            Back to home
          </Link>
          <h1 className="text-[2.8125rem] font-medium leading-tight">
            {isSignup ? "Create your account" : "Log in"}
          </h1>
          <p className="text-sm text-brand-navy/70">
            {isSignup
              ? "Register to manage quotes, order history, and logo assets."
              : "Access your account to track quote requests and order progress."}
          </p>
        </header>

        <div className="flex rounded-xl border border-brand-navy/15 p-1 text-sm font-medium">
          <Link
            href="/log-in"
            className={`flex-1 rounded-lg px-3 py-2 text-center transition ${
              !isSignup ? "bg-brand-navy text-white" : "text-brand-navy hover:bg-brand-surface"
            }`}
          >
            Log in
          </Link>
          <Link
            href="/log-in?mode=signup"
            className={`flex-1 rounded-lg px-3 py-2 text-center transition ${
              isSignup ? "bg-brand-navy text-white" : "text-brand-navy hover:bg-brand-surface"
            }`}
          >
            Sign up
          </Link>
        </div>

        {!isSignup && status === "invalid" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            <AlertTriangleIcon className="h-4 w-4" />
            Please enter both email and password.
          </p>
        )}
        {!isSignup && status === "no_account" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            No account found for this email. Please sign up first, or check the spelling.
          </p>
        )}
        {!isSignup && status === "legacy_account" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <AlertTriangleIcon className="h-4 w-4" />
            This email is on file from an earlier registration. Use the password you created then, or choose
            &ldquo;Send reset email&rdquo; below to set a new one.
          </p>
        )}
        {!isSignup && status === "mismatch" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Incorrect password for this email. Try again or use &ldquo;Send reset email&rdquo; below.
          </p>
        )}
        {!isSignup && status === "error" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Could not log in right now. Please try again.
          </p>
        )}
        {!isSignup && status === "oauth_error" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Social sign-in did not complete. Please try again
            {params.message ? ` (${params.message})` : "."}
          </p>
        )}
        {!isSignup && status === "reset_invalid" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            <AlertTriangleIcon className="h-4 w-4" />
            Please enter your email to receive a temporary password.
          </p>
        )}
        {!isSignup && status === "reset_not_found" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            We couldn&apos;t find an account with that email.
          </p>
        )}
        {!isSignup && status === "reset_sent" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Password reset email sent. Please check your inbox.
          </p>
        )}
        {!isSignup && status === "reset_email_config" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <AlertTriangleIcon className="h-4 w-4" />
            Email sending is not configured on this site yet. If you manage the site, add{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">RESEND_API_KEY</code> in
            the hosting environment.
          </p>
        )}
        {!isSignup && status === "reset_email_error" && (
          <p className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              We found your account, but we couldn&apos;t send the email just now. Please try again
              in a few minutes. If it keeps happening, contact us and we&apos;ll sort it out.
            </span>
          </p>
        )}
        {!isSignup && status === "reset_error" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Could not reset password right now. Please try again.
          </p>
        )}

        {isSignup && status === "invalid" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            <AlertTriangleIcon className="h-4 w-4" />
            Please fill in all required fields.
          </p>
        )}
        {isSignup && status === "password_mismatch" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            <AlertTriangleIcon className="h-4 w-4" />
            Passwords do not match. Please try again.
          </p>
        )}
        {isSignup && status === "weak_password" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            <AlertTriangleIcon className="h-4 w-4" />
            Password must be at least 6 characters. Please choose a longer password.
          </p>
        )}
        {isSignup && status === "email_exists" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            This email is already registered.{" "}
            <Link href="/log-in" className="underline underline-offset-2">
              Log in
            </Link>{" "}
            instead.
          </p>
        )}
        {isSignup && status === "legacy_exists" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <AlertTriangleIcon className="h-4 w-4" />
            This email is already on file from an earlier registration.{" "}
            <Link href="/log-in" className="underline underline-offset-2">
              Log in
            </Link>{" "}
            with your original password, or use &ldquo;Send reset email&rdquo; on the Log in tab.
          </p>
        )}
        {isSignup && status === "auth_exists" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <AlertTriangleIcon className="h-4 w-4" />
            An account with this email already exists.{" "}
            <Link href="/log-in" className="underline underline-offset-2">
              Log in
            </Link>{" "}
            or use &ldquo;Send reset email&rdquo; if you forgot your password.
          </p>
        )}
        {isSignup && status === "signup_failed" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Could not complete sign-up. Please try again or contact us for help.
          </p>
        )}
        {isSignup && status === "error" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Something went wrong during sign-up. Please try again.
          </p>
        )}
        {isSignup && status === "recaptcha_failed" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Please complete the &ldquo;I&apos;m not a robot&rdquo; check and try again.
          </p>
        )}
        {isSignup && status === "recaptcha_config" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <AlertTriangleIcon className="h-4 w-4" />
            Sign-up verification is not configured on this site yet. Please try again later or contact us.
          </p>
        )}

        <LogInFormsClient isSignup={isSignup} />
        </div>
      </div>
    </main>
  );
}

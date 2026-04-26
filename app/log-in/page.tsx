import Link from "next/link";

import { AlertTriangleIcon, ArrowLeftIcon, XCircleIcon } from "@/app/components/icons";

import { requestTemporaryPassword, submitLogIn, submitSignUp } from "./actions";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

type LogInPageProps = {
  searchParams: Promise<{
    mode?: string;
    status?: string;
    email?: string;
    full_name?: string;
  }>;
};

export default async function LogInPage({ searchParams }: LogInPageProps) {
  const params = await searchParams;
  const isSignup = params.mode === "signup";
  const status = params.status;
  // Always render clean forms when switching tabs.
  const prefilledEmail = "";
  const prefilledFullName = "";

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
        {!isSignup && status === "mismatch" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Login details do not match. Please try again.
          </p>
        )}
        {!isSignup && status === "error" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Could not log in right now. Please try again.
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
            Temporary password sent. Please check your email.
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
        {isSignup && status === "email_exists" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            This email is already registered. Please use a different email.
          </p>
        )}
        {isSignup && status === "error" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Your email is already registered. Please register a new email address.
          </p>
        )}

        {isSignup ? (
          <form action={submitSignUp} className="grid gap-4 rounded-2xl p-6">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-semibold">
                Full Name
              </label>
              <input
                id="name"
                name="full_name"
                type="text"
                defaultValue=""
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="email-signup" className="text-sm font-semibold">
                Email
              </label>
              <input
                id="email-signup"
                name="email"
                type="email"
                defaultValue=""
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password-signup" className="text-sm font-semibold">
                Password
              </label>
              <input
                id="password-signup"
                name="password"
                type="password"
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="confirm_password" className="text-sm font-semibold">
                Confirm Password
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="mt-2 rounded-xl bg-brand-orange px-5 py-2.5 text-sm font-medium text-brand-navy transition hover:brightness-95"
            >
              Sign up
            </button>
          </form>
        ) : (
          <form action={submitLogIn} className="grid gap-4 rounded-2xl p-6">
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-semibold">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue=""
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-semibold">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="mt-2 rounded-xl bg-brand-orange px-5 py-2.5 text-sm font-medium text-brand-navy transition hover:brightness-95"
            >
              Log in
            </button>
            <div className="mt-6 space-y-2 pt-5">
              <h2 className="text-sm font-semibold text-brand-navy">Lost password?</h2>
              <p className="text-sm leading-relaxed text-brand-navy/70">
                Enter your email and we&apos;ll send a temporary password. After logging in, go to{" "}
                <span className="font-semibold">Customer</span> → <span className="font-semibold">Change password</span>{" "}
                to set a new password.
              </p>
              <button
                type="submit"
                formAction={requestTemporaryPassword}
                className="rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-navy/90"
              >
                Send temporary password
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </main>
  );
}

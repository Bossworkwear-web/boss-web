import Link from "next/link";

import { AlertTriangleIcon, ArrowLeftIcon, XCircleIcon } from "@/app/components/icons";

import { submitLogIn, submitSignUp } from "./actions";
import { OAuthProviderButtons } from "./oauth-provider-buttons";
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
  const prefilledEmail = params.email ?? "";
  const prefilledFullName = params.full_name ?? "";

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
        {!isSignup && status === "oauth_only" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
            <AlertTriangleIcon className="h-4 w-4" />
            This account is linked to a social provider. Use one of the provider buttons above instead of a password.
          </p>
        )}
        {status === "oauth_error" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Social sign-in did not complete. Please try again or use email.
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

        <OAuthProviderButtons context={isSignup ? "signup" : "login"} />

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <span className="w-full border-t border-brand-navy/15" />
          </div>
          <div className="relative flex justify-center text-xs font-medium uppercase tracking-wide text-brand-navy/50">
            <span className="bg-white px-3">
              {isSignup ? "Or sign up with email" : "Or log in with email"}
            </span>
          </div>
        </div>

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
                defaultValue={prefilledFullName}
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
                defaultValue={prefilledEmail}
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
                defaultValue={prefilledEmail}
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
            {/* ISSUE:customer-password-reset — contact-only until automated email/link reset exists; see AGENTS.md Backlog. */}
            <div className="mt-6 space-y-2 pt-5">
              <h2 className="text-sm font-semibold text-brand-navy">Lost password?</h2>
              <p className="text-sm leading-relaxed text-brand-navy/70">
                If you registered with email and password,{" "}
                <Link
                  href="/contact-us"
                  className="font-semibold text-brand-orange underline-offset-2 hover:underline"
                >
                  contact us
                </Link>{" "}
                and we can help you reset your login. If you use social sign-in, use the provider buttons above.
              </p>
            </div>
          </form>
        )}
        </div>
      </div>
    </main>
  );
}

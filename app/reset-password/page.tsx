import Link from "next/link";

import { ArrowLeftIcon, XCircleIcon } from "@/app/components/icons";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

import { submitPasswordReset } from "./reset-password-actions";

type Props = {
  searchParams: Promise<{ token?: string; email?: string; status?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = (params.token ?? "").trim();
  const email = (params.email ?? "").trim();
  const status = (params.status ?? "").trim();

  return (
    <main className="min-h-screen bg-white py-10 text-brand-navy">
      <div className={SITE_PAGE_ROW_CLASS}>
        <div className="mx-auto w-full max-w-md space-y-6">
          <header className="space-y-3">
            <Link
              href="/log-in"
              className="inline-flex items-center gap-2 text-[1.3125rem] font-semibold leading-snug text-brand-orange"
            >
              <ArrowLeftIcon className="h-6 w-6 shrink-0" />
              Back to log in
            </Link>
            <h1 className="text-[2.25rem] font-medium leading-tight">Reset password</h1>
            <p className="text-sm text-brand-navy/70">Choose a new password for your account.</p>
          </header>

          {status === "invalid" ? (
            <p className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>This reset link is invalid or expired. Please request a new one.</span>
            </p>
          ) : null}

          <form action={submitPasswordReset} className="grid gap-4 rounded-2xl p-6">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="email" value={email} />

            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-semibold">
                New password
              </label>
              <input id="password" name="password" type="password" className="rounded-md border border-brand-navy/20 px-3 py-2" />
            </div>

            <div className="grid gap-2">
              <label htmlFor="confirm_password" className="text-sm font-semibold">
                Confirm password
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
              Set new password
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}


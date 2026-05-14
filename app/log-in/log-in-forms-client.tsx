"use client";

import type React from "react";
import { useEffect, useMemo, useRef } from "react";

import { requestTemporaryPassword, submitLogIn, submitSignUp } from "./actions";

type Props = {
  isSignup: boolean;
};

function useAlwaysResetForm(formRef: React.RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    // Run on mount to clear browser-restored values.
    form.reset();

    const onPageShow = () => {
      // BFCache restore (back/forward) can repopulate inputs; wipe again.
      form.reset();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [formRef]);
}

export function LogInFormsClient({ isSignup }: Props) {
  const loginRef = useRef<HTMLFormElement | null>(null);
  const signupRef = useRef<HTMLFormElement | null>(null);

  useAlwaysResetForm(isSignup ? signupRef : loginRef);

  // Force a remount when switching tabs to drop any retained DOM state.
  const key = useMemo(() => (isSignup ? "signup" : "login"), [isSignup]);

  return isSignup ? (
    <form
      key={key}
      ref={signupRef}
      action={submitSignUp}
      autoComplete="off"
      className="grid gap-4 rounded-2xl p-6"
    >
      <div className="grid gap-2">
        <label htmlFor="name" className="text-sm font-semibold">
          Full Name
        </label>
        <input
          id="name"
          name="full_name"
          type="text"
          autoComplete="off"
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
          autoComplete="off"
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
          autoComplete="new-password"
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
          autoComplete="new-password"
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
    <form
      key={key}
      ref={loginRef}
      action={submitLogIn}
      autoComplete="off"
      className="grid gap-4 rounded-2xl p-6"
    >
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-semibold">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
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
          autoComplete="new-password"
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
        <p className="text-sm leading-relaxed text-brand-navy/70">Enter your email and we&apos;ll send you a password reset link.</p>
        <button
          type="submit"
          formAction={requestTemporaryPassword}
          className="rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-navy/90"
        >
          Send reset email
        </button>
      </div>
    </form>
  );
}


"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { OAuthSignInButtons } from "./oauth-sign-in-buttons";
import { SignupRecaptcha, type SignupRecaptchaHandle } from "./signup-recaptcha";
import { requestTemporaryPassword, submitLogIn, submitSignUp } from "./actions";

type Props = {
  isSignup: boolean;
  signupStatus?: string | null;
};

const SIGNUP_STATUSES_RESET_RECAPTCHA = new Set([
  "recaptcha_failed",
  "recaptcha_expired",
  "invalid",
  "password_mismatch",
  "weak_password",
  "email_exists",
  "legacy_exists",
  "auth_exists",
  "signup_failed",
  "error",
]);

function useAlwaysResetForm(
  formRef: React.RefObject<HTMLFormElement | null>,
  onReset?: () => void,
) {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    // Run on mount to clear browser-restored values.
    form.reset();
    onReset?.();

    const onPageShow = () => {
      // BFCache restore (back/forward) can repopulate inputs; wipe again.
      form.reset();
      onReset?.();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [formRef, onReset]);
}

export function LogInFormsClient({ isSignup, signupStatus }: Props) {
  const loginRef = useRef<HTMLFormElement | null>(null);
  const signupRef = useRef<HTMLFormElement | null>(null);
  const recaptchaRef = useRef<SignupRecaptchaHandle | null>(null);
  const submittingRef = useRef(false);
  const [recaptchaClientError, setRecaptchaClientError] = useState(false);
  const [isSubmitting, startSignupTransition] = useTransition();

  const resetRecaptcha = useCallback(() => {
    recaptchaRef.current?.reset();
    setRecaptchaClientError(false);
  }, []);

  useAlwaysResetForm(isSignup ? signupRef : loginRef, isSignup ? resetRecaptcha : undefined);

  useEffect(() => {
    if (!isSignup || !signupStatus) {
      return;
    }
    if (SIGNUP_STATUSES_RESET_RECAPTCHA.has(signupStatus)) {
      resetRecaptcha();
    }
  }, [isSignup, signupStatus, resetRecaptcha]);

  const readRecaptchaToken = useCallback(
    () =>
      new Promise<string>((resolve) => {
        const read = () => resolve(recaptchaRef.current?.syncHiddenField() ?? "");
        if (typeof window !== "undefined" && window.grecaptcha?.ready) {
          window.grecaptcha.ready(read);
          return;
        }
        read();
      }),
    [],
  );

  const handleSignupSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    submittingRef.current = true;

    void readRecaptchaToken().then((token) => {
      if (!token) {
        submittingRef.current = false;
        setRecaptchaClientError(true);
        return;
      }

      setRecaptchaClientError(false);
      const formData = new FormData(form);
      formData.set("recaptcha_token", token);
      formData.set("g-recaptcha-response", token);

      startSignupTransition(() => {
        void submitSignUp(formData).finally(() => {
          submittingRef.current = false;
        });
      });
    });
  };

  // Force a remount when switching tabs to drop any retained DOM state.
  const key = useMemo(() => (isSignup ? "signup" : "login"), [isSignup]);

  return isSignup ? (
    <>
    <OAuthSignInButtons mode="signup" />
    <div className="my-4 flex items-center gap-3 text-xs text-brand-navy/40">
      <span className="h-px flex-1 bg-brand-navy/15" />
      <span>or use email</span>
      <span className="h-px flex-1 bg-brand-navy/15" />
    </div>
    <form
      key={key}
      ref={signupRef}
      autoComplete="off"
      className="grid gap-4 rounded-2xl p-6"
      onSubmit={handleSignupSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="first_name" className="text-sm font-semibold">
            First Name
          </label>
          <input
            id="first_name"
            name="first_name"
            type="text"
            autoComplete="given-name"
            defaultValue=""
            className="rounded-md border border-brand-navy/20 px-3 py-2"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="surname" className="text-sm font-semibold">
            Surname
          </label>
          <input
            id="surname"
            name="surname"
            type="text"
            autoComplete="family-name"
            defaultValue=""
            className="rounded-md border border-brand-navy/20 px-3 py-2"
          />
        </div>
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
          placeholder="At least 6 characters"
          className="rounded-md border border-brand-navy/20 px-3 py-2 placeholder:text-brand-navy/40"
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
      <SignupRecaptcha
        ref={recaptchaRef}
        onCompleted={() => setRecaptchaClientError(false)}
        onExpired={() => setRecaptchaClientError(true)}
      />
      {recaptchaClientError ? (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          Please complete the &ldquo;I&apos;m not a robot&rdquo; check, then tap Sign up again.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-xl bg-brand-orange px-5 py-2.5 text-sm font-medium text-brand-navy transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Signing up…" : "Sign up"}
      </button>
    </form>
    </>
  ) : (
    <>
    <OAuthSignInButtons mode="login" />
    <div className="my-4 flex items-center gap-3 text-xs text-brand-navy/40">
      <span className="h-px flex-1 bg-brand-navy/15" />
      <span>or use email</span>
      <span className="h-px flex-1 bg-brand-navy/15" />
    </div>
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
    </>
  );
}


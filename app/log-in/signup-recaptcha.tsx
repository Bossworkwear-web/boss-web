"use client";

import { useEffect, useRef, useState } from "react";

const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? "";

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string;
          theme?: "light" | "dark";
          callback?: () => void;
          "error-callback"?: () => void;
        },
      ) => number;
      reset: (widgetId?: number) => void;
    };
    __bossRecaptchaOnload?: () => void;
  }
}

const SCRIPT_ID = "boss-recaptcha-v2-script";
const pendingMounts: Array<() => void> = [];

function flushPendingMounts() {
  const queue = pendingMounts.splice(0);
  for (const run of queue) {
    run();
  }
}

function loadRecaptchaScript(onLoad: () => void) {
  if (typeof window === "undefined") {
    return;
  }

  if (window.grecaptcha?.render) {
    onLoad();
    return;
  }

  pendingMounts.push(onLoad);
  window.__bossRecaptchaOnload = flushPendingMounts;

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    // Script tag from a prior visit but API never became ready — replace it.
    if (!window.grecaptcha?.render) {
      existing.remove();
    } else {
      return;
    }
  }

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = "https://www.google.com/recaptcha/api.js?onload=__bossRecaptchaOnload&render=explicit";
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    document.getElementById(SCRIPT_ID)?.remove();
  };
  document.head.appendChild(script);
}

/** reCAPTCHA v2 checkbox for email sign-up only. */
export function SignupRecaptcha() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountGenerationRef = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showLocalhostHint, setShowLocalhostHint] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }
    const host = window.location.hostname;
    setShowLocalhostHint(host === "127.0.0.1" || host === "localhost");
  }, []);

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    const generation = ++mountGenerationRef.current;
    setLoadError(null);

    const mount = () => {
      if (mountGenerationRef.current !== generation) {
        return;
      }
      const el = containerRef.current;
      if (!el || !window.grecaptcha?.render) {
        return;
      }

      el.innerHTML = "";
      try {
        window.grecaptcha.render(el, {
          sitekey: siteKey,
          theme: "light",
          "error-callback": () => {
            if (mountGenerationRef.current === generation) {
              setLoadError("reCAPTCHA could not load. Check allowed domains in Google reCAPTCHA admin.");
            }
          },
        });
      } catch {
        if (mountGenerationRef.current === generation) {
          setLoadError("reCAPTCHA could not render. Refresh the page and try again.");
        }
      }
    };

    loadRecaptchaScript(mount);

    const timeout = window.setTimeout(() => {
      if (mountGenerationRef.current !== generation) {
        return;
      }
      const el = containerRef.current;
      if (!el || el.querySelector("iframe")) {
        return;
      }
      setLoadError(
        "reCAPTCHA did not appear. Use Sign up tab, allow google.com scripts, and add 127.0.0.1 and localhost to your reCAPTCHA site domains.",
      );
    }, 8000);

    return () => {
      window.clearTimeout(timeout);
      if (mountGenerationRef.current === generation) {
        mountGenerationRef.current += 1;
      }
      const el = containerRef.current;
      if (el) {
        el.innerHTML = "";
      }
    };
  }, []);

  if (!siteKey) {
    if (process.env.NODE_ENV === "development") {
      return (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          reCAPTCHA is not configured. Add{" "}
          <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_RECAPTCHA_SITE_KEY</code> and{" "}
          <code className="rounded bg-amber-100 px-1">RECAPTCHA_SECRET_KEY</code> to{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code>, then restart{" "}
          <code className="rounded bg-amber-100 px-1">npm run dev</code>.
        </p>
      );
    }
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-[78px] justify-center">
        <div ref={containerRef} />
      </div>
      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {loadError}
        </p>
      ) : null}
      {showLocalhostHint && !loadError ? (
        <p className="text-center text-[11px] text-brand-navy/50">
          Local dev: add <strong>127.0.0.1</strong> and <strong>localhost</strong> under Domains in Google
          reCAPTCHA admin if the checkbox does not show.
        </p>
      ) : null}
    </div>
  );
}

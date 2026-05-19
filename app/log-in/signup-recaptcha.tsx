"use client";

import { useEffect, useRef } from "react";

const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? "";

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string;
          theme?: "light" | "dark";
        },
      ) => number;
      reset: (widgetId?: number) => void;
    };
    __bossRecaptchaOnload?: () => void;
  }
}

const SCRIPT_ID = "boss-recaptcha-v2-script";

function loadRecaptchaScript(onLoad: () => void) {
  if (typeof window === "undefined") {
    return;
  }
  if (window.grecaptcha?.render) {
    onLoad();
    return;
  }

  if (document.getElementById(SCRIPT_ID)) {
    window.__bossRecaptchaOnload = onLoad;
    return;
  }

  window.__bossRecaptchaOnload = onLoad;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = "https://www.google.com/recaptcha/api.js?onload=__bossRecaptchaOnload&render=explicit";
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

/** reCAPTCHA v2 checkbox for email sign-up only. */
export function SignupRecaptcha() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      return;
    }

    const mount = () => {
      if (!containerRef.current || !window.grecaptcha?.render) {
        return;
      }
      if (widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        return;
      }
      widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
      });
    };

    loadRecaptchaScript(mount);

    return () => {
      widgetIdRef.current = null;
    };
  }, []);

  if (!siteKey) {
    if (process.env.NODE_ENV === "development") {
      return (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          reCAPTCHA is not configured. Add{" "}
          <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_RECAPTCHA_SITE_KEY</code> and{" "}
          <code className="rounded bg-amber-100 px-1">RECAPTCHA_SECRET_KEY</code> to{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code>.
        </p>
      );
    }
    return null;
  }

  return (
    <div className="flex justify-center">
      <div ref={containerRef} />
    </div>
  );
}

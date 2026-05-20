"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? "";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string;
          theme?: "light" | "dark";
          "error-callback"?: () => void;
        },
      ) => number;
    };
  }
}

/** reCAPTCHA v2 checkbox for email sign-up only. */
export function SignupRecaptcha() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const renderWidget = useCallback(() => {
    const el = containerRef.current;
    if (!el || !siteKey || !window.grecaptcha?.render) {
      return false;
    }
    if (widgetIdRef.current !== null) {
      return true;
    }
    el.innerHTML = "";
    try {
      widgetIdRef.current = window.grecaptcha.render(el, {
        sitekey: siteKey,
        theme: "light",
        "error-callback": () => {
          setLoadError("reCAPTCHA rejected this page. Confirm the site key in .env.local matches this reCAPTCHA key.");
        },
      });
      setLoadError(null);
      return true;
    } catch {
      setLoadError("reCAPTCHA could not render. Hard-refresh the page (Cmd+Shift+R).");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!scriptReady) {
      return;
    }
    renderWidget();
  }, [scriptReady, renderWidget]);

  useEffect(() => {
    if (!siteKey || !scriptReady) {
      return;
    }
    const timeout = window.setTimeout(() => {
      const el = containerRef.current;
      if (!el?.querySelector("iframe") && !el?.querySelector(".g-recaptcha-bubble-arrow")) {
        setLoadError(
          process.env.NODE_ENV === "development"
            ? "reCAPTCHA still not visible. Try a private window, disable ad blockers, or use RECAPTCHA_DEV_BYPASS=1 in .env.local (already set — restart npm run dev)."
            : "reCAPTCHA did not load. Please refresh and try again.",
        );
      }
    }, 10000);
    return () => window.clearTimeout(timeout);
  }, [scriptReady]);

  if (!siteKey) {
    if (process.env.NODE_ENV === "development") {
      return (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Add <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_RECAPTCHA_SITE_KEY</code> to{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code> and restart{" "}
          <code className="rounded bg-amber-100 px-1">npm run dev</code>.
        </p>
      );
    }
    return null;
  }

  return (
    <div className="space-y-2">
      <Script
        id="boss-recaptcha-v2"
        src="https://www.google.com/recaptcha/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => {
          const ready = () => {
            if (window.grecaptcha?.ready) {
              window.grecaptcha.ready(() => setScriptReady(true));
              return;
            }
            window.setTimeout(ready, 50);
          };
          ready();
        }}
        onError={() => {
          setLoadError(
            "Could not load google.com/recaptcha (blocked network or extension). Use RECAPTCHA_DEV_BYPASS=1 for local sign-up tests.",
          );
        }}
      />
      <div className="flex min-h-[78px] justify-center">
        <div ref={containerRef} />
      </div>
      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {loadError}
        </p>
      ) : null}
    </div>
  );
}

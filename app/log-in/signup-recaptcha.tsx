"use client";

import Script from "next/script";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

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
          size?: "normal" | "compact";
          callback?: () => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => number;
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
    };
  }
}

export type SignupRecaptchaHandle = {
  getResponse: () => string;
  reset: () => void;
  syncHiddenField: () => string;
};

type Props = {
  onCompleted?: () => void;
  onExpired?: () => void;
};

function readTokenFromWidget(
  widgetId: number | null,
  tokenRef: React.MutableRefObject<string>,
  form: HTMLFormElement | null | undefined,
): string {
  let token = tokenRef.current.trim();
  if (!token && widgetId !== null && window.grecaptcha?.getResponse) {
    token = String(window.grecaptcha.getResponse(widgetId) ?? "").trim();
  }
  if (!token) {
    const scopes: ParentNode[] = [];
    if (form) scopes.push(form);
    if (typeof document !== "undefined") scopes.push(document);
    for (const scope of scopes) {
      for (const field of scope.querySelectorAll<HTMLTextAreaElement>(
        'textarea[name="g-recaptcha-response"]',
      )) {
        const value = field.value.trim();
        if (value) {
          token = value;
          break;
        }
      }
      if (token) break;
    }
  }
  tokenRef.current = token;
  return token;
}

/** reCAPTCHA v2 checkbox for email sign-up only. */
export const SignupRecaptcha = forwardRef<SignupRecaptchaHandle, Props>(function SignupRecaptcha(
  { onCompleted, onExpired },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const tokenRef = useRef("");
  const [scriptReady, setScriptReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const resetWidget = useCallback(() => {
    const widgetId = widgetIdRef.current;
    if (widgetId !== null && window.grecaptcha?.reset) {
      window.grecaptcha.reset(widgetId);
    }
    tokenRef.current = "";
    setExpired(false);
  }, []);

  const syncHiddenField = useCallback(() => {
    const form = containerRef.current?.closest("form");
    return readTokenFromWidget(widgetIdRef.current, tokenRef, form);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getResponse: () => syncHiddenField(),
      reset: resetWidget,
      syncHiddenField,
    }),
    [resetWidget, syncHiddenField],
  );

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
        size: "normal",
        callback: () => {
          setExpired(false);
          setLoadError(null);
          syncHiddenField();
          onCompleted?.();
        },
        "expired-callback": () => {
          tokenRef.current = "";
          setExpired(true);
          onExpired?.();
        },
        "error-callback": () => {
          tokenRef.current = "";
          setLoadError(
            "reCAPTCHA rejected this page. Refresh and try again, or contact us if the problem continues.",
          );
        },
      });
      setLoadError(null);
      return true;
    } catch {
      setLoadError("reCAPTCHA could not render. Please refresh the page and try again.");
      return false;
    }
  }, [onCompleted, onExpired, syncHiddenField]);

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
            ? "reCAPTCHA still not visible. Try a private window, disable ad blockers, or use RECAPTCHA_DEV_BYPASS=1 in .env.local."
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
            "Could not load reCAPTCHA (network or blocker). Refresh the page or try another browser.",
          );
        }}
      />
      <div className="flex min-h-[78px] justify-center overflow-x-auto">
        <div ref={containerRef} />
      </div>
      {expired ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Verification expired. Please tick &ldquo;I&apos;m not a robot&rdquo; again before signing up.
        </p>
      ) : null}
      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {loadError}
        </p>
      ) : null}
    </div>
  );
});

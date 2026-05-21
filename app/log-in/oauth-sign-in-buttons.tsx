"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { CUSTOMER_OAUTH_FLOW_COOKIE } from "@/lib/customer-oauth-flow";
import type { OAuthProvider } from "@/lib/customer-auth";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { GoogleIcon, MicrosoftIcon } from "./oauth-provider-icons";

type Props = {
  mode: "login" | "signup";
};

const PROVIDERS: {
  id: OAuthProvider;
  label: string;
  icon: ReactNode;
}[] = [
  {
    id: "google",
    label: "Continue with Google",
    icon: <GoogleIcon className="h-7 w-7" />,
  },
  {
    id: "azure",
    label: "Continue with Microsoft",
    icon: <MicrosoftIcon className="h-7 w-7" />,
  },
];

const oauthButtonClass =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 shadow-none transition hover:bg-brand-navy/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 disabled:opacity-50";

/** Supabase OAuth may drop query params on redirect; cookie survives for Google and Microsoft. */
function setOAuthFlowCookie(mode: "login" | "signup") {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CUSTOMER_OAUTH_FLOW_COOKIE}=${mode}; path=/; max-age=600; SameSite=Lax${secure}`;
}

export function OAuthSignInButtons({ mode }: Props) {
  const [loading, setLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: OAuthProvider) {
    setLoading(provider);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    // Match the browser origin (127.0.0.1 vs localhost) so Supabase redirect URLs align.
    const siteOrigin =
      typeof window !== "undefined" ? window.location.origin : getSiteUrl();
    setOAuthFlowCookie(mode);
    const redirectTo = `${siteOrigin}/auth/callback?next=${encodeURIComponent("/")}&flow=${mode}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        ...(provider === "azure"
          ? { scopes: "openid profile email offline_access" }
          : {}),
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-xs font-medium uppercase tracking-wide text-brand-navy/50">
        {mode === "signup" ? "Or sign up with" : "Or continue with"}
      </p>
      <div className="flex items-center justify-center gap-6">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={loading !== null}
            onClick={() => signInWith(p.id)}
            aria-label={loading === p.id ? `${p.label} — redirecting` : p.label}
            aria-pressed={loading === p.id}
            title={p.label}
            className={`${oauthButtonClass} ${loading === p.id ? "bg-brand-navy/5" : ""}`}
          >
            {p.icon}
          </button>
        ))}
      </div>
      {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

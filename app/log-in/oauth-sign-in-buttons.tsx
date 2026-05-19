"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import type { OAuthProvider } from "@/lib/customer-auth";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { AppleIcon, GoogleIcon, MicrosoftIcon } from "./oauth-provider-icons";

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
  {
    id: "apple",
    label: "Continue with Apple",
    icon: <AppleIcon className="h-7 w-7 text-brand-navy" />,
  },
];

const oauthButtonClass =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 shadow-none transition hover:bg-brand-navy/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 disabled:opacity-50";

export function OAuthSignInButtons({ mode }: Props) {
  const [loading, setLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: OAuthProvider) {
    setLoading(provider);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/")}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        ...(provider === "azure" ? { scopes: "email openid profile" } : {}),
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

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
  className: string;
  icon: ReactNode;
}[] = [
  {
    id: "google",
    label: "Continue with Google",
    className: "border-slate-200 bg-white hover:bg-slate-50",
    icon: <GoogleIcon className="h-6 w-6" />,
  },
  {
    id: "azure",
    label: "Continue with Microsoft",
    className: "border-slate-200 bg-white hover:bg-slate-50",
    icon: <MicrosoftIcon className="h-6 w-6" />,
  },
  {
    id: "apple",
    label: "Continue with Apple",
    className: "border-brand-navy/20 bg-brand-navy hover:bg-brand-navy/90",
    icon: <AppleIcon className="h-6 w-6 text-white" />,
  },
];

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
      <div className="flex items-stretch justify-center gap-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={loading !== null}
            onClick={() => signInWith(p.id)}
            aria-label={loading === p.id ? `${p.label} — redirecting` : p.label}
            title={p.label}
            className={`flex h-12 flex-1 max-w-[5.5rem] items-center justify-center rounded-xl border transition disabled:opacity-60 ${p.className} ${loading === p.id ? "ring-2 ring-brand-orange/60" : ""}`}
          >
            {p.icon}
          </button>
        ))}
      </div>
      {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

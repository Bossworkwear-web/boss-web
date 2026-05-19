"use client";

import { useState } from "react";

import type { OAuthProvider } from "@/lib/customer-auth";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  mode: "login" | "signup";
};

const PROVIDERS: { id: OAuthProvider; label: string; className: string }[] = [
  { id: "google", label: "Continue with Google", className: "border-slate-200 bg-white hover:bg-slate-50 text-brand-navy" },
  { id: "azure", label: "Continue with Microsoft", className: "border-slate-200 bg-white hover:bg-slate-50 text-brand-navy" },
  { id: "apple", label: "Continue with Apple", className: "border-brand-navy/20 bg-brand-navy text-white hover:bg-brand-navy/90" },
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
      <div className="grid gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={loading !== null}
            onClick={() => signInWith(p.id)}
            className={`flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${p.className}`}
          >
            {loading === p.id ? "Redirecting…" : p.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type LoginFormProps = {
  devHint: string | null;
};

function LoginFields({ devHint }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/admin";
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push(from.startsWith("/admin") ? from : "/admin");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/5 p-8 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Boss Web</p>
      <h1 className="mt-2 text-2xl font-medium">Admin sign in</h1>
      <p className="mt-2 text-sm text-white/70">
        Use the password from <code className="rounded bg-white/10 px-1">BOSS_ADMIN_PASSWORD</code> in{" "}
        <code className="rounded bg-white/10 px-1">.env.local</code> (production).
      </p>
      {devHint && (
        <p className="mt-3 rounded-lg border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 text-sm text-white">
          {devHint}
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="admin-user" className="mb-1 block text-sm font-semibold">
            Email / name
          </label>
          <input
            id="admin-user"
            type="text"
            autoComplete="username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-white placeholder:text-white/50"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label htmlFor="admin-password" className="mb-1 block text-sm font-semibold">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-white placeholder:text-white/50"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-sm font-medium text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-orange py-2.5 text-base font-medium text-brand-navy transition hover:brightness-95 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in to Dashboard"}
        </button>
      </form>
      <p className="mt-3 text-xs text-white/60">
        Access control is optional. If enabled, this value must match an entry in Accounting → Access control.
      </p>
      <Link href="/" className="mt-6 block text-center text-sm font-semibold text-brand-orange hover:underline">
        ← Back to store
      </Link>
    </div>
  );
}

export function AdminLoginForm(props: LoginFormProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/5 p-8 text-center text-sm text-white/70">
          Loading…
        </div>
      }
    >
      <LoginFields {...props} />
    </Suspense>
  );
}

import Link from "next/link";

import type { XeroConnectionPublic } from "@/lib/xero/connection-db";
import { getXeroRedirectUri, isXeroOAuthConfigured } from "@/lib/xero/config";

type Props = {
  connection: XeroConnectionPublic | null;
  loadError: string | null;
};

function formatPerthDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Perth",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function XeroConnectionSection({ connection, loadError }: Props) {
  const configured = isXeroOAuthConfigured();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-medium text-brand-navy">Xero connection</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Phase 1: connect your Xero organisation so the site can create sales invoices automatically (phase 2).
        Invoice numbers will come from <strong>Xero</strong>, not the web store.
      </p>

      {loadError ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loadError}
        </div>
      ) : null}

      {!configured ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Set <code className="text-xs">XERO_CLIENT_ID</code> and <code className="text-xs">XERO_CLIENT_SECRET</code>{" "}
          in Vercel / <code className="text-xs">.env.local</code>, then redeploy. See{" "}
          <code className="text-xs">docs/XERO_SETUP.md</code>.
        </div>
      ) : null}

      {connection ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <p>
              <strong>Connected:</strong> {connection.tenant_name}
            </p>
            <p className="mt-1 text-emerald-900/80">
              Tenant ID <span className="font-mono text-xs">{connection.tenant_id}</span>
            </p>
            <p className="mt-1 text-emerald-900/80">
              Token refreshed / saved: {formatPerthDateTime(connection.updated_at)}
            </p>
          </div>
          <form action="/api/xero/disconnect" method="post">
            <button
              type="submit"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Disconnect Xero
            </button>
          </form>
        </div>
      ) : configured && !loadError ? (
        <div className="mt-4">
          <p className="text-sm text-slate-600">Not connected. Authorise Boss Workwear in Xero (one organisation).</p>
          <Link
            href="/api/xero/connect"
            className="mt-3 inline-flex rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-orange/90"
          >
            Connect to Xero
          </Link>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        Redirect URI must match your Xero app:{" "}
        <code className="break-all">{getXeroRedirectUri()}</code>
      </p>
    </section>
  );
}

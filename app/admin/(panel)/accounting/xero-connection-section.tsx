import Link from "next/link";

import { resyncFailedXeroOrdersAction } from "@/app/admin/(panel)/accounting/xero-actions";
import type { XeroConnectionPublic } from "@/lib/xero/connection-db";
import {
  connectionHasInvoiceScope,
  connectionHasPaymentScope,
  getXeroClientIdLength,
  getXeroClientIdPrefix,
  getXeroClientIdSuffix,
  getXeroRedirectUri,
  isXeroOAuthConfigured,
} from "@/lib/xero/config";

/** Xero OAuth2 Client IDs are always 32 characters; anything else means a bad paste in the env var. */
const XERO_CLIENT_ID_EXPECTED_LENGTH = 32;

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
  const clientIdPrefix = getXeroClientIdPrefix();
  const clientIdSuffix = getXeroClientIdSuffix();
  const clientIdLength = getXeroClientIdLength();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-medium text-brand-navy">Xero connection</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Paid store orders can create <strong>AUTHORISED</strong> sales invoices in Xero. Invoice numbers come from{" "}
        <strong>Xero</strong> and are copied to the order for tax invoice PDFs.
      </p>

      {loadError ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loadError}
        </div>
      ) : null}

      {configured && clientIdLength > 0 && clientIdLength !== XERO_CLIENT_ID_EXPECTED_LENGTH ? (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p>
            <strong>Client ID looks wrong.</strong> Xero Client IDs are {XERO_CLIENT_ID_EXPECTED_LENGTH} characters, but
            this deployment has <strong>{clientIdLength}</strong>. Re-copy <code className="text-xs">XERO_CLIENT_ID</code>{" "}
            from Xero → My Apps → Configuration into Vercel (no spaces, quotes, or line breaks), redeploy, then reconnect.
          </p>
        </div>
      ) : null}

      {loadError && /invalid_client/i.test(loadError) ? (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p>
            <strong>Xero rejected the credentials (invalid_client).</strong> The{" "}
            <code className="text-xs">XERO_CLIENT_ID</code> / <code className="text-xs">XERO_CLIENT_SECRET</code> in
            Vercel do not match your Xero app. Re-copy both from Xero → My Apps → Configuration, redeploy, then click
            Connect to Xero again.
          </p>
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
          {connectionHasInvoiceScope(connection.scopes) ? (
            <p className="text-sm text-emerald-800">Invoice sync permission: enabled</p>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p>
                Invoice permission is not granted yet. Click below to re-authorise (adds{" "}
                <code className="text-xs">accounting.invoices</code> and{" "}
                <code className="text-xs">accounting.payments</code>).
              </p>
              <Link
                href="/api/xero/connect?upgrade=1"
                className="mt-3 inline-flex rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-orange/90"
              >
                Upgrade Xero for invoices &amp; payments
              </Link>
            </div>
          )}
          {connectionHasInvoiceScope(connection.scopes) ? (
            connectionHasPaymentScope(connection.scopes) ? (
              <p className="text-sm text-emerald-800">Payment sync permission: enabled</p>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p>
                  <strong>Payment permission missing.</strong> Marking invoices Paid in Xero needs{" "}
                  <code className="text-xs">accounting.payments</code> (separate from invoices).
                </p>
                <Link
                  href="/api/xero/connect?upgrade=1"
                  className="mt-3 inline-flex rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-orange/90"
                >
                  Upgrade Xero for payments
                </Link>
              </div>
            )
          ) : null}
          {connectionHasInvoiceScope(connection.scopes) ? (
            <p className="text-xs text-slate-500">
              Scopes: <span className="font-mono break-all">{connection.scopes ?? "(none recorded)"}</span>
            </p>
          ) : null}
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

      {configured ? (
        <form action={resyncFailedXeroOrdersAction} className="mt-5 border-t border-slate-100 pt-4">
          <button
            type="submit"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            Resync paid orders missing from Xero
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Pushes recent paid orders that have no Xero invoice yet (e.g. orders placed while the connection was down).
            Safe to run anytime — already-synced orders are skipped, and customers are never charged again.
          </p>
        </form>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        Redirect URI must match your Xero app:{" "}
        <code className="break-all">{getXeroRedirectUri()}</code>
      </p>
      {configured && clientIdPrefix ? (
        <p className="mt-2 text-xs text-slate-500">
          This deployment&apos;s Client id:{" "}
          <code className="font-mono">
            {clientIdPrefix}…{clientIdSuffix}
          </code>{" "}
          ({clientIdLength} characters — compare start/end with Xero → Configuration)
        </p>
      ) : null}
    </section>
  );
}

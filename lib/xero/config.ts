/** Xero OAuth 2 + Accounting API (AU). See docs/XERO_SETUP.md */

import { getSiteUrl } from "@/lib/site-url";

export const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
export const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
export const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

const XERO_OAUTH_SCOPE_BASE = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.settings.read",
  "accounting.contacts",
] as const;

/**
 * Granular scope for invoices (replaces deprecated accounting.transactions on new Xero apps).
 * @see https://developer.xero.com/faq/granular-scopes
 */
export const XERO_OAUTH_SCOPES_INVOICES = "accounting.invoices";

/** Record payments on invoices (separate from accounting.invoices on granular scopes). */
export const XERO_OAUTH_SCOPES_PAYMENTS = "accounting.payments";

/** Scopes for initial Connect (phase 1) — omit transactions if authorize fails. */
export const XERO_OAUTH_SCOPES = [...XERO_OAUTH_SCOPE_BASE].join(" ");

/** Upgrade / phase 2+ adds invoices + payments (and credit notes via invoices scope). */
export function getXeroOAuthScopes(includeUpgradeScopes: boolean): string {
  const scopes: string[] = [...XERO_OAUTH_SCOPE_BASE];
  if (includeUpgradeScopes) {
    scopes.push(XERO_OAUTH_SCOPES_INVOICES, XERO_OAUTH_SCOPES_PAYMENTS);
  }
  return scopes.join(" ");
}

export function connectionHasInvoiceScope(scopes: string | null): boolean {
  const s = scopes ?? "";
  return s.includes(XERO_OAUTH_SCOPES_INVOICES) || s.includes("accounting.transactions");
}

export function connectionHasPaymentScope(scopes: string | null): boolean {
  const s = scopes ?? "";
  return s.includes(XERO_OAUTH_SCOPES_PAYMENTS) || s.includes("accounting.transactions");
}

export const XERO_OAUTH_STATE_COOKIE = "boss_xero_oauth_state";

export type XeroSyncStatus = "pending" | "synced" | "failed" | "skipped";

/** Strip whitespace and accidental quotes from Vercel / .env paste. */
function cleanEnvVar(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function getXeroClientId(): string {
  const id = cleanEnvVar(process.env.XERO_CLIENT_ID);
  if (!id) {
    throw new Error("XERO_CLIENT_ID is not set.");
  }
  return id;
}

export function getXeroClientSecret(): string {
  const secret = cleanEnvVar(process.env.XERO_CLIENT_SECRET);
  if (!secret) {
    throw new Error("XERO_CLIENT_SECRET is not set.");
  }
  return secret;
}

export function isXeroOAuthConfigured(): boolean {
  return Boolean(cleanEnvVar(process.env.XERO_CLIENT_ID) && cleanEnvVar(process.env.XERO_CLIENT_SECRET));
}

/** First 4 chars of Client id on this deployment (for admin troubleshooting). */
export function getXeroClientIdPrefix(): string | null {
  const id = cleanEnvVar(process.env.XERO_CLIENT_ID);
  return id.length >= 4 ? id.slice(0, 4) : id || null;
}

/** Last 4 chars — compare with Xero → Configuration → Client id. */
export function getXeroClientIdSuffix(): string | null {
  const id = cleanEnvVar(process.env.XERO_CLIENT_ID);
  return id.length >= 4 ? id.slice(-4) : id || null;
}

export function getXeroClientIdLength(): number {
  return cleanEnvVar(process.env.XERO_CLIENT_ID).length;
}

export function getXeroRedirectUri(): string {
  const override = process.env.XERO_REDIRECT_URI?.trim();
  if (override) {
    return override.replace(/\/$/, "");
  }
  return `${getSiteUrl()}/api/xero/callback`;
}

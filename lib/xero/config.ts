/** Xero OAuth 2 + Accounting API (AU). See docs/XERO_SETUP.md */

import { getSiteUrl } from "@/lib/site-url";

export const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
export const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
export const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

/** Scopes requested at Connect (phase 1). */
export const XERO_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.settings.read",
  "accounting.contacts",
].join(" ");

/**
 * Added before phase 2 invoice sync — reconnect Xero after enabling.
 * Some tenants hit unauthorized_client when accounting.transactions is in the initial authorize URL.
 */
export const XERO_OAUTH_SCOPES_INVOICES = "accounting.transactions";

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

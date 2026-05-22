/** Xero OAuth 2 + Accounting API (AU). See docs/XERO_SETUP.md */

import { getSiteUrl } from "@/lib/site-url";

export const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
export const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
export const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

/** Scopes for contact + sales invoice sync (phase 2). */
export const XERO_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.settings.read",
  "accounting.contacts",
  "accounting.transactions",
].join(" ");

export const XERO_OAUTH_STATE_COOKIE = "boss_xero_oauth_state";

export type XeroSyncStatus = "pending" | "synced" | "failed" | "skipped";

export function getXeroClientId(): string {
  const id = process.env.XERO_CLIENT_ID?.trim();
  if (!id) {
    throw new Error("XERO_CLIENT_ID is not set.");
  }
  return id;
}

export function getXeroClientSecret(): string {
  const secret = process.env.XERO_CLIENT_SECRET?.trim();
  if (!secret) {
    throw new Error("XERO_CLIENT_SECRET is not set.");
  }
  return secret;
}

export function isXeroOAuthConfigured(): boolean {
  return Boolean(process.env.XERO_CLIENT_ID?.trim() && process.env.XERO_CLIENT_SECRET?.trim());
}

export function getXeroRedirectUri(): string {
  const override = process.env.XERO_REDIRECT_URI?.trim();
  if (override) {
    return override.replace(/\/$/, "");
  }
  return `${getSiteUrl()}/api/xero/callback`;
}

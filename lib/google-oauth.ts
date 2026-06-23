import { createHash, randomBytes } from "node:crypto";

import type { NextResponse } from "next/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
export const GOOGLE_OAUTH_NONCE_COOKIE = "google_oauth_nonce";
export const GOOGLE_OAUTH_NEXT_COOKIE = "google_oauth_next";

const OAUTH_COOKIE_MAX_AGE = 600;

export function getGoogleOAuthClientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!id) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID");
  }
  return id;
}

export function getGoogleOAuthClientSecret(): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_SECRET");
  }
  return secret;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
  );
}

export function googleOAuthCallbackPath(): string {
  return "/api/auth/google/callback";
}

export function googleOAuthRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}${googleOAuthCallbackPath()}`;
}

export function createGoogleOAuthSecrets(): { state: string; nonce: string; hashedNonce: string } {
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const hashedNonce = createHash("sha256").update(nonce).digest("hex");
  return { state, nonce, hashedNonce };
}

export function googleOAuthCookieOptions() {
  return {
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

export function buildGoogleOAuthAuthorizeUrl(options: {
  origin: string;
  state: string;
  hashedNonce: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", getGoogleOAuthClientId());
  url.searchParams.set("redirect_uri", googleOAuthRedirectUri(options.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", options.state);
  url.searchParams.set("nonce", options.hashedNonce);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

type GoogleTokenResponse = {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleOAuthCode(options: {
  code: string;
  origin: string;
}): Promise<{ idToken: string } | { error: string }> {
  const body = new URLSearchParams({
    code: options.code,
    client_id: getGoogleOAuthClientId(),
    client_secret: getGoogleOAuthClientSecret(),
    redirect_uri: googleOAuthRedirectUri(options.origin),
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !data.id_token) {
    const message = data.error_description ?? data.error ?? "Google token exchange failed";
    return { error: message };
  }

  return { idToken: data.id_token };
}

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { CustomerOAuthFlow } from "@/lib/customer-oauth-flow";
import { getSiteUrl } from "@/lib/site-url";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type SignedOAuthStatePayload = {
  nonce: string;
  flow: CustomerOAuthFlow;
  next: string;
  exp: number;
};

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

/** Canonical origin for Google redirect_uri (www vs apex must stay consistent). */
export function getGoogleOAuthOrigin(request: Request): string {
  const requestOrigin = new URL(request.url).origin;
  if (requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1")) {
    return requestOrigin;
  }
  return getSiteUrl().replace(/\/$/, "");
}

function oauthStateSigningKey(): string {
  return getGoogleOAuthClientSecret();
}

function signOAuthStatePayload(payloadB64: string): string {
  return createHmac("sha256", oauthStateSigningKey()).update(payloadB64).digest("base64url");
}

function verifyOAuthStateSignature(payloadB64: string, signature: string): boolean {
  const expected = signOAuthStatePayload(payloadB64);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Signed state survives Google redirect without cookies (fixes www/apex cookie loss). */
export function createSignedGoogleOAuthState(options: {
  flow: CustomerOAuthFlow;
  next: string;
}): { state: string; hashedNonce: string; nonce: string } {
  const nonce = randomBytes(32).toString("base64url");
  const payload: SignedOAuthStatePayload = {
    nonce,
    flow: options.flow,
    next: options.next,
    exp: Date.now() + OAUTH_STATE_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const state = `${payloadB64}.${signOAuthStatePayload(payloadB64)}`;
  const hashedNonce = createHash("sha256").update(nonce).digest("hex");
  return { state, hashedNonce, nonce };
}

export function verifySignedGoogleOAuthState(
  state: string,
): { ok: true; nonce: string; flow: CustomerOAuthFlow; next: string } | { ok: false } {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) {
    return { ok: false };
  }
  const payloadB64 = state.slice(0, dot);
  const signature = state.slice(dot + 1);
  if (!verifyOAuthStateSignature(payloadB64, signature)) {
    return { ok: false };
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as SignedOAuthStatePayload;
    if (!parsed.nonce || parsed.exp < Date.now()) {
      return { ok: false };
    }
    const flow: CustomerOAuthFlow = parsed.flow === "login" ? "login" : "signup";
    const next =
      typeof parsed.next === "string" && parsed.next.startsWith("/") && !parsed.next.startsWith("//")
        ? parsed.next
        : "/";
    return { ok: true, nonce: parsed.nonce, flow, next };
  } catch {
    return { ok: false };
  }
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
  url.searchParams.set("state", options.state); // signed payload returned by Google unchanged
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

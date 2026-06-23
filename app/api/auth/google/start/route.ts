import { NextResponse } from "next/server";

import { CUSTOMER_OAUTH_FLOW_COOKIE, type CustomerOAuthFlow } from "@/lib/customer-oauth-flow";
import {
  buildGoogleOAuthAuthorizeUrl,
  createGoogleOAuthSecrets,
  getGoogleOAuthClientId,
  googleOAuthCookieOptions,
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleOAuthConfigured,
} from "@/lib/google-oauth";

function parseFlow(value: string | null): CustomerOAuthFlow {
  return value === "login" ? "login" : "signup";
}

function parseNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const site = requestUrl.origin;

  if (!isGoogleOAuthConfigured()) {
    console.error("[api/auth/google/start] GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set");
    return NextResponse.redirect(`${site}/log-in?status=oauth_error`);
  }

  try {
    getGoogleOAuthClientId();
  } catch {
    return NextResponse.redirect(`${site}/log-in?status=oauth_error`);
  }

  const flow = parseFlow(requestUrl.searchParams.get("flow"));
  const next = parseNext(requestUrl.searchParams.get("next"));
  const { state, nonce, hashedNonce } = createGoogleOAuthSecrets();
  const authorizeUrl = buildGoogleOAuthAuthorizeUrl({
    origin: site,
    state,
    hashedNonce,
  });

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOpts = googleOAuthCookieOptions();
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, cookieOpts);
  response.cookies.set(GOOGLE_OAUTH_NONCE_COOKIE, nonce, cookieOpts);
  response.cookies.set(GOOGLE_OAUTH_NEXT_COOKIE, next, cookieOpts);
  response.cookies.set(CUSTOMER_OAUTH_FLOW_COOKIE, flow, cookieOpts);
  return response;
}

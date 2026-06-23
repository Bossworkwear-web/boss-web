import { NextResponse } from "next/server";

import type { CustomerOAuthFlow } from "@/lib/customer-oauth-flow";
import {
  buildGoogleOAuthAuthorizeUrl,
  createSignedGoogleOAuthState,
  getGoogleOAuthClientId,
  getGoogleOAuthOrigin,
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
  const oauthOrigin = getGoogleOAuthOrigin(request);
  const { state, hashedNonce } = createSignedGoogleOAuthState({ flow, next });
  const authorizeUrl = buildGoogleOAuthAuthorizeUrl({
    origin: oauthOrigin,
    state,
    hashedNonce,
  });

  return NextResponse.redirect(authorizeUrl);
}

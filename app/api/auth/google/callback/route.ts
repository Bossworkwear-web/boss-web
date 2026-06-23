import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildCustomerOAuthCompleteRedirect } from "@/lib/customer-oauth-complete";
import { consumeCustomerOAuthFlowCookie } from "@/lib/customer-auth";
import {
  exchangeGoogleOAuthCode,
  googleOAuthCookieOptions,
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleOAuthConfigured,
} from "@/lib/google-oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function oauthErrorRedirect(site: string, message?: string) {
  const qs = new URLSearchParams({ status: "oauth_error" });
  if (message) {
    qs.set("message", message);
  }
  return NextResponse.redirect(`${site}/log-in?${qs.toString()}`);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const site = requestUrl.origin;

  if (!isGoogleOAuthConfigured()) {
    return oauthErrorRedirect(site);
  }

  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  if (errorParam) {
    return oauthErrorRedirect(site, errorDescription ?? errorParam);
  }

  const code = requestUrl.searchParams.get("code");
  const stateParam = requestUrl.searchParams.get("state");
  if (!code || !stateParam) {
    return oauthErrorRedirect(site);
  }

  const cookieStore = await cookies();
  const clearCookie = { ...googleOAuthCookieOptions(), maxAge: 0 };
  const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const nonce = cookieStore.get(GOOGLE_OAUTH_NONCE_COOKIE)?.value;
  const next = cookieStore.get(GOOGLE_OAUTH_NEXT_COOKIE)?.value ?? "/";

  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, "", clearCookie);
  cookieStore.set(GOOGLE_OAUTH_NONCE_COOKIE, "", clearCookie);
  cookieStore.set(GOOGLE_OAUTH_NEXT_COOKIE, "", clearCookie);

  if (!expectedState || expectedState !== stateParam || !nonce) {
    return oauthErrorRedirect(site, "Invalid OAuth state");
  }

  const tokenResult = await exchangeGoogleOAuthCode({ code, origin: site });
  if ("error" in tokenResult) {
    console.error("[api/auth/google/callback] token exchange:", tokenResult.error);
    return oauthErrorRedirect(site);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokenResult.idToken,
    nonce,
  });

  if (error) {
    console.error("[api/auth/google/callback] signInWithIdToken:", error.message);
    return oauthErrorRedirect(site);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return oauthErrorRedirect(site);
  }

  const oauthFlow = await consumeCustomerOAuthFlowCookie();

  try {
    return await buildCustomerOAuthCompleteRedirect({
      supabase,
      user,
      oauthFlow,
      site,
      next: next.startsWith("/") && !next.startsWith("//") ? next : "/",
    });
  } catch (e) {
    console.error("[api/auth/google/callback] complete:", e);
    return oauthErrorRedirect(site);
  }
}

import { NextResponse } from "next/server";

import { buildCustomerOAuthCompleteRedirect } from "@/lib/customer-oauth-complete";
import {
  exchangeGoogleOAuthCode,
  getGoogleOAuthOrigin,
  isGoogleOAuthConfigured,
  verifySignedGoogleOAuthState,
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
  const oauthOrigin = getGoogleOAuthOrigin(request);

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

  const verified = verifySignedGoogleOAuthState(stateParam);
  if (!verified.ok) {
    return oauthErrorRedirect(site, "Invalid OAuth state");
  }

  const tokenResult = await exchangeGoogleOAuthCode({ code, origin: oauthOrigin });
  if ("error" in tokenResult) {
    console.error("[api/auth/google/callback] token exchange:", tokenResult.error);
    return oauthErrorRedirect(site);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokenResult.idToken,
    nonce: verified.nonce,
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

  try {
    return await buildCustomerOAuthCompleteRedirect({
      supabase,
      user,
      oauthFlow: verified.flow,
      site,
      next: verified.next,
    });
  } catch (e) {
    console.error("[api/auth/google/callback] complete:", e);
    return oauthErrorRedirect(site);
  }
}

import { NextResponse } from "next/server";

import {
  consumeCustomerOAuthFlowCookie,
  finalizeCustomerAuthSession,
  getCustomerProfileByAuthUserId,
  getCustomerProfileByEmail,
} from "@/lib/customer-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const oauthFlowFromQuery = requestUrl.searchParams.get("flow") === "login" ? "login" : null;
  const oauthFlowFromCookie = await consumeCustomerOAuthFlowCookie();
  const oauthFlow = oauthFlowFromQuery ?? oauthFlowFromCookie;
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const requestOrigin = new URL(request.url).origin;
  // Stay on the same host the user used (www vs apex) so auth cookies apply.
  const site = requestOrigin;

  if (errorParam) {
    const qs = new URLSearchParams({
      status: "oauth_error",
      message: errorDescription ?? errorParam,
    });
    return NextResponse.redirect(`${site}/log-in?${qs.toString()}`);
  }

  if (!code) {
    return NextResponse.redirect(`${site}/log-in?status=oauth_error`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession:", error.message);
    return NextResponse.redirect(`${site}/log-in?status=oauth_error`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${site}/log-in?status=oauth_error`);
  }

  try {
    const emailNorm = user.email?.trim().toLowerCase() ?? "";
    let profile = (await getCustomerProfileByAuthUserId(user.id)).profile;
    if (!profile && emailNorm) {
      profile = (await getCustomerProfileByEmail(emailNorm)).profile;
    }

    if (oauthFlow === "login") {
      if (!profile) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${site}/log-in?status=oauth_no_account`);
      }
    }

    if (oauthFlow === "signup" && profile) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${site}/log-in?mode=signup&status=oauth_already_registered`);
    }

    const result = await finalizeCustomerAuthSession(user);

    if (result.status === "ready") {
      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return NextResponse.redirect(`${site}${safeNext}`);
    }

    const qs = new URLSearchParams({
      email: result.email,
      ...(result.fullName ? { full_name: result.fullName } : {}),
    });
    return NextResponse.redirect(`${site}/customer-details?${qs.toString()}`);
  } catch (e) {
    console.error("[auth/callback] finalizeCustomerAuthSession:", e);
    return NextResponse.redirect(`${site}/log-in?status=oauth_error`);
  }
}

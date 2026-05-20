import { NextResponse } from "next/server";

import { finalizeCustomerAuthSession } from "@/lib/customer-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const requestOrigin = new URL(request.url).origin;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || requestOrigin;

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

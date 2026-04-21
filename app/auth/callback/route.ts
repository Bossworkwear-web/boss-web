import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase";

const SESSION_COOKIE_OPTIONS = {
  path: "/" as const,
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

const OAUTH_COOKIE_OPTIONS = {
  path: "/" as const,
  maxAge: 60 * 30,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
};

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    const { name, value, ...opts } = cookie;
    to.cookies.set(name, value, opts);
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  const errorRedirect = `${origin}/log-in?status=oauth_error`;

  if (!code) {
    return NextResponse.redirect(errorRedirect);
  }

  const authResponse = NextResponse.redirect(errorRedirect);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            authResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return authResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return authResponse;
  }

  const email = user.email.trim().toLowerCase();
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fullName =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    email.split("@")[0] ||
    "Customer";

  let redirectTo = `${origin}/`;

  try {
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from("customer_profiles")
      .select("customer_name, email_address, delivery_address")
      .eq("email_address", email)
      .maybeSingle();

    if (profile) {
      authResponse.cookies.set("customer_name", profile.customer_name, SESSION_COOKIE_OPTIONS);
      authResponse.cookies.set("customer_email", profile.email_address, SESSION_COOKIE_OPTIONS);
      authResponse.cookies.set(
        "customer_delivery_address",
        profile.delivery_address ?? "",
        SESSION_COOKIE_OPTIONS,
      );
    } else {
      redirectTo = `${origin}/customer-details?full_name=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}`;
      authResponse.cookies.set("customer_oauth_pending", "1", OAUTH_COOKIE_OPTIONS);
      authResponse.cookies.set("customer_oauth_email", email, OAUTH_COOKIE_OPTIONS);
    }
  } catch {
    const fail = NextResponse.redirect(`${origin}/log-in?status=oauth_error`);
    copyCookies(authResponse, fail);
    return fail;
  }

  const final = NextResponse.redirect(redirectTo);
  copyCookies(authResponse, final);
  return final;
}

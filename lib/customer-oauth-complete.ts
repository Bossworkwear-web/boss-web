import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { CustomerOAuthFlow } from "@/lib/customer-oauth-flow";
import {
  finalizeCustomerAuthSession,
  getCustomerProfileByAuthUserId,
  getCustomerProfileByEmail,
} from "@/lib/customer-auth";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function buildCustomerOAuthCompleteRedirect(options: {
  supabase: SupabaseServerClient;
  user: User;
  oauthFlow: CustomerOAuthFlow;
  site: string;
  next: string;
}): Promise<NextResponse> {
  const { supabase, user, oauthFlow, site, next } = options;

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
}

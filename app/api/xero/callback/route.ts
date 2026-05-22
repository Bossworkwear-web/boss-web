import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/site-url";
import { XERO_OAUTH_STATE_COOKIE } from "@/lib/xero/config";
import { saveXeroConnection } from "@/lib/xero/connection-db";
import { exchangeAuthorizationCode, fetchXeroOrgConnections } from "@/lib/xero/oauth";

function accountingRedirect(query: Record<string, string>): NextResponse {
  const base = getSiteUrl();
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return NextResponse.redirect(`${base}/admin/accounting${qs ? `?${qs}` : ""}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    const desc = url.searchParams.get("error_description") ?? error;
    return accountingRedirect({ xero_error: desc });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return accountingRedirect({ xero_error: "Missing authorization code or state." });
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(XERO_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(XERO_OAUTH_STATE_COOKIE);

  if (!expectedState || expectedState !== state) {
    return accountingRedirect({ xero_error: "Invalid OAuth state. Try connecting again." });
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    const orgs = await fetchXeroOrgConnections(tokens.access_token);
    if (!orgs.length) {
      return accountingRedirect({
        xero_error: "No Xero organisation was authorised. Connect again and select your organisation.",
      });
    }

    const org = orgs[0];
    await saveXeroConnection({
      tenantId: org.tenantId,
      tenantName: org.tenantName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expires_in,
      scopes: tokens.scope,
    });

    return accountingRedirect({ xero: "connected" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Xero callback failed";
    return accountingRedirect({ xero_error: msg });
  }
}

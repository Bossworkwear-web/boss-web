import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-auth";
import { getSiteUrl } from "@/lib/site-url";
import { XERO_OAUTH_STATE_COOKIE } from "@/lib/xero/config";
import { buildXeroAuthorizeUrl } from "@/lib/xero/oauth";

export async function GET() {
  try {
    await assertAdminSession();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", getSiteUrl()));
  }

  try {
    const state = randomBytes(24).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(XERO_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return NextResponse.redirect(buildXeroAuthorizeUrl(state));
  } catch (e) {
    const msg = encodeURIComponent(e instanceof Error ? e.message : "Xero connect failed");
    return NextResponse.redirect(`${getSiteUrl()}/admin/accounting?xero_error=${msg}`);
  }
}

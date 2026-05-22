import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-auth";
import { getSiteUrl } from "@/lib/site-url";
import { clearXeroConnection } from "@/lib/xero/connection-db";

export async function POST(request: Request) {
  try {
    await assertAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await clearXeroConnection();
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("application/json")) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.redirect(`${getSiteUrl()}/admin/accounting?xero=disconnected`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Disconnect failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

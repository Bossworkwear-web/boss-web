import { NextResponse } from "next/server";

import { isAdminSession } from "@/lib/admin-auth";
import { establishAdminCustomerSession } from "@/lib/admin-customer-impersonation";

export async function GET(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const email = requestUrl.searchParams.get("email") ?? "";
  const result = await establishAdminCustomerSession(email);

  if (!result.ok) {
    const back = new URL("/admin/customer-info", requestUrl.origin);
    back.searchParams.set("impersonate_error", result.error);
    if (email.trim()) {
      back.searchParams.set("email", email.trim().toLowerCase());
    }
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(new URL(result.redirectTo, requestUrl.origin));
}

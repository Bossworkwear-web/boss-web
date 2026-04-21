import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, ADMIN_USER_COOKIE } from "@/lib/admin-constants";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  cookieStore.delete(ADMIN_USER_COOKIE);
  return NextResponse.json({ ok: true });
}

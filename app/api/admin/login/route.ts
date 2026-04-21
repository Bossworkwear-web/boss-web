import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, ADMIN_USER_COOKIE } from "@/lib/admin-constants";
import { getExpectedAdminPassword } from "@/lib/admin-password";

export async function POST(request: Request) {
  const expected = getExpectedAdminPassword();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Admin password is not configured. Set BOSS_ADMIN_PASSWORD in .env.local." },
      { status: 503 },
    );
  }

  let body: { password?: string; user?: string };
  try {
    body = (await request.json()) as { password?: string; user?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const user = String(body.user ?? "").trim();
  if (password !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: "Missing user (email/name)" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/",
  });
  cookieStore.set(ADMIN_USER_COOKIE, user, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}

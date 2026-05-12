import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { findActiveAdminAccessUserByIdentifier } from "@/lib/admin-access-users";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, ADMIN_USER_COOKIE } from "@/lib/admin-constants";
import { getExpectedAdminPassword } from "@/lib/admin-password";
import { verifyAdminUserPassword } from "@/lib/admin-user-password-hash";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const expected = getExpectedAdminPassword();

  let body: { password?: string; user?: string };
  try {
    body = (await request.json()) as { password?: string; user?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const password = String(body.password ?? "").trim();
  const userInput = String(body.user ?? "").trim();

  let enforcing = false;
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from("admin_access_users").select("id").eq("is_active", true).limit(1);
    enforcing = (data ?? []).length > 0;
  } catch {
    enforcing = false;
  }

  const cookieStore = await cookies();
  const sessionOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/",
  };

  if (!enforcing) {
    if (!expected) {
      return NextResponse.json(
        { ok: false, error: "Admin password is not configured. Set BOSS_ADMIN_PASSWORD in .env.local." },
        { status: 503 },
      );
    }
    if (password !== expected) {
      return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
    }
    if (!userInput) {
      return NextResponse.json({ ok: false, error: "Missing user (email/name)" }, { status: 400 });
    }
    cookieStore.set(ADMIN_SESSION_COOKIE, "1", sessionOpts);
    cookieStore.set(ADMIN_USER_COOKIE, userInput, sessionOpts);
    return NextResponse.json({ ok: true });
  }

  if (!userInput) {
    return NextResponse.json({ ok: false, error: "Missing user (email/name)" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const row = await findActiveAdminAccessUserByIdentifier(supabase, userInput);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const hasHash = Boolean(row.password_hash?.trim());
  const ok = hasHash
    ? verifyAdminUserPassword(password, row.password_hash)
    : Boolean(expected) && password === expected;

  if (!ok) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  cookieStore.set(ADMIN_SESSION_COOKIE, "1", sessionOpts);
  cookieStore.set(ADMIN_USER_COOKIE, row.identifier, sessionOpts);

  return NextResponse.json({ ok: true });
}

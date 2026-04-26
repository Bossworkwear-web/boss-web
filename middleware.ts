import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Must stay in sync with `lib/admin-constants.ts` — Vercel Edge middleware cannot import app `@/` paths. */
const ADMIN_SESSION_COOKIE = "boss_admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (session === "1") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

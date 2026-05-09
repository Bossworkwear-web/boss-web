import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Must stay in sync with `lib/admin-constants.ts` — Vercel Edge middleware cannot import app `@/` paths. */
const ADMIN_SESSION_COOKIE = "boss_admin_session";

/** Must stay in sync with `lib/supplier-orders-warehouse-manager.ts`. */
const SUPPLIER_ORDERS_WAREHOUSE_MANAGER_COOKIE = "boss_supplier_orders_wm";

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
    if (pathname === "/admin/supplier-orders") {
      const res = NextResponse.next();
      const wm = request.nextUrl.searchParams.get("warehouse_manager");
      const wmActive = wm === "1" || wm === "true";
      if (wmActive) {
        res.cookies.set(SUPPLIER_ORDERS_WAREHOUSE_MANAGER_COOKIE, "1", {
          path: "/admin",
          maxAge: 60 * 60 * 8,
          sameSite: "lax",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        });
      } else {
        res.cookies.set(SUPPLIER_ORDERS_WAREHOUSE_MANAGER_COOKIE, "", {
          path: "/admin",
          maxAge: 0,
          sameSite: "lax",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        });
      }
      return res;
    }
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

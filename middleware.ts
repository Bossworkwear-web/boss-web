import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ADMIN_PATHNAME_HEADER } from "./lib/admin-constants";
import { homeLegacyQueryRedirectUrl } from "./lib/home-legacy-query-redirect";

/** Must stay in sync with `lib/admin-constants.ts` — middleware imports via relative path (no `@/`). */
const ADMIN_SESSION_COOKIE = "boss_admin_session";

/** Must stay in sync with `lib/supplier-orders-warehouse-manager.ts`. */
const SUPPLIER_ORDERS_WAREHOUSE_MANAGER_COOKIE = "boss_supplier_orders_wm";

function nextWithAdminPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ADMIN_PATHNAME_HEADER, pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const dest = homeLegacyQueryRedirectUrl(request.nextUrl.searchParams);
    if (dest) {
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (session === "1") {
    const res = nextWithAdminPathname(request, pathname);
    if (pathname === "/admin/supplier-orders") {
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
    }
    return res;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/admin", "/admin/:path*"],
};

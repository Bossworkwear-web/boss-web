import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { publicStorageObjectUrl } from "./lib/supabase-public-storage-url";

/** Must stay in sync with `lib/admin-constants.ts` — Vercel Edge middleware cannot import app `@/` paths. */
const ADMIN_SESSION_COOKIE = "boss_admin_session";

const SUPPLIER_MEDIA_PREFIX = "/api/supplier-media/";

function supplierMediaRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith(SUPPLIER_MEDIA_PREFIX)) {
    return null;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("Method Not Allowed", { status: 405 });
  }
  const tail = pathname.slice(SUPPLIER_MEDIA_PREFIX.length);
  const parts = tail.split("/").filter(Boolean);
  if (parts.length < 2) {
    return new NextResponse("Not found", { status: 404 });
  }
  const supplier = parts[0]!;
  const segments = parts.slice(1);
  const bucket = process.env.SUPPLIER_IMAGES_BUCKET ?? "supplier-product-images";
  const objectPath = [supplier, ...segments].join("/").replace(/\/+/g, "/");
  const url = publicStorageObjectUrl(bucket, objectPath);
  if (!url) {
    return new NextResponse("Storage not configured", { status: 503 });
  }
  return NextResponse.redirect(url, 307);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const media = supplierMediaRedirect(request);
  if (media) {
    return media;
  }

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
  matcher: ["/admin", "/admin/:path*", "/api/supplier-media", "/api/supplier-media/:path*"],
};

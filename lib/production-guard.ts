import { NextResponse } from "next/server";

/** Block dev-only API routes in production unless explicitly enabled. */
export function blockDebugRouteInProduction(): NextResponse | null {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEBUG_ROUTES !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

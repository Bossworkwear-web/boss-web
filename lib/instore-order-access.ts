import type { NextRequest } from "next/server";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function localDevAuthRequired(): boolean {
  return process.env.INSTORE_ORDER_REQUIRE_AUTH === "1";
}

export function isLocalDevHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase());
}

/** Skip admin login for /instore_order when running `npm run dev` on localhost. */
export function isInstoreOrderLocalDevAccess(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (localDevAuthRequired()) return false;
  return isLocalDevHost(request.nextUrl.hostname);
}

/** Server actions: same bypass when NODE_ENV is development (local `next dev` only). */
export function isInstoreOrderLocalDevActionBypass(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  return !localDevAuthRequired();
}

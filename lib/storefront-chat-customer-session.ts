import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function requireStorefrontCustomerEmail():
  | { ok: true; emailNorm: string }
  | { ok: false; response: NextResponse } {
  const c = await cookies();
  const raw = (c.get("customer_email")?.value ?? "").trim();
  if (!raw) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 }),
    };
  }
  return { ok: true, emailNorm: raw.toLowerCase() };
}

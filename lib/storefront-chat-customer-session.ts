import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type StorefrontChatCustomerSessionResult =
  | { ok: true; emailNorm: string }
  | { ok: false; response: NextResponse };

export async function requireStorefrontCustomerEmail(): Promise<StorefrontChatCustomerSessionResult> {
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

import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-auth";
import { resendStoreOrderTaxInvoiceEmail } from "@/lib/store-order-invoice-email";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await assertAdminSession();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { orderId?: string };
  try {
    body = (await request.json()) as { orderId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const orderId = (body.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId is required." }, { status: 400 });
  }

  try {
    const result = await resendStoreOrderTaxInvoiceEmail(orderId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    console.error("[resend-invoice-email]", e);
    const msg = e instanceof Error ? e.message : "Server error while sending invoice email.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

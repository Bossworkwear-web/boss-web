import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-auth";
import { recordStoreOrderPaymentInXero } from "@/lib/xero/sync-store-order-payment";

export async function POST(request: Request) {
  try {
    await assertAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orderId?: string };
  try {
    body = (await request.json()) as { orderId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const orderId = (body.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const result = await recordStoreOrderPaymentInXero(orderId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, skipped: result.skipped ?? false }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    paymentId: result.paymentId,
    alreadyPaid: result.alreadyPaid ?? false,
  });
}

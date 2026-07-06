import { NextResponse } from "next/server";

import { resyncFailedXeroOrders } from "@/lib/xero/resync-failed-orders";

export const dynamic = "force-dynamic";

/**
 * Periodically re-pushes paid store orders that never reached Xero (no `xero_invoice_id`). Once the
 * Xero connection is healthy again, missed orders backfill automatically — no admin action needed.
 *
 * GET /api/cron/xero-resync
 * Authorization: Bearer $CRON_SECRET
 *
 * Vercel Cron: `0 5,10 * * *` UTC = 1:00 PM and 6:00 PM Australia/Perth (see vercel.json).
 * Only looks back a limited window so it never dredges ancient history.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await resyncFailedXeroOrders({ maxOrders: 50, sinceDays: 30 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

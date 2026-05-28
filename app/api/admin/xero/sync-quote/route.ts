import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-auth";
import type { AdminCustomerQuoteSheetV1 } from "@/app/admin/(panel)/store-orders/internal-order/actions";
import { syncCustomerQuoteSheetToXero } from "@/lib/xero/sync-customer-quote";

export async function POST(request: Request) {
  try {
    await assertAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sheet?: AdminCustomerQuoteSheetV1; quoteRequestId?: string | null };
  try {
    body = (await request.json()) as { sheet?: AdminCustomerQuoteSheetV1; quoteRequestId?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.sheet || body.sheet.v !== 1) {
    return NextResponse.json({ error: "Valid customer quote sheet (v1) is required." }, { status: 400 });
  }

  try {
    const result = await syncCustomerQuoteSheetToXero(body.sheet, body.quoteRequestId ?? null);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, skipped: result.skipped ?? false }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      quoteId: result.quoteId,
      quoteNumber: result.quoteNumber,
      openUrl: result.openUrl,
      alreadySynced: result.alreadySynced,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xero quote sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

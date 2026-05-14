import { NextResponse } from "next/server";

import { purgeAccountingReceiptsPastRetention } from "@/lib/accounting-receipt-retention";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Purges accounting receipt images past retention (Perth `expense_date`):
 * - Category **Equipment** (case-insensitive): 5 years
 * - All other categories: 1 year
 * Removes the Storage object and sets `receipt_storage_path` to null; expense rows stay.
 *
 * GET /api/cron/accounting-receipt-retention
 * Authorization: Bearer $CRON_SECRET
 *
 * Vercel Cron: weekly (see vercel.json). Increase maxRows in code if you batch more than 2000 per run.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const result = await purgeAccountingReceiptsPastRetention(supabase, { maxRows: 2000 });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { sendStorefrontCatalogHealthAlert } from "@/lib/storefront-catalog-alert";
import { checkStorefrontCatalogHealth } from "@/lib/storefront-catalog-health";

export const dynamic = "force-dynamic";

/**
 * Probes the live storefront catalog (anon Supabase, same as category pages).
 *
 * GET /api/cron/storefront-catalog-health
 * Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await checkStorefrontCatalogHealth();
  let emailed = false;
  if (!health.ok) {
    const alert = await sendStorefrontCatalogHealthAlert(health);
    emailed = alert.ok;
  }

  return NextResponse.json({
    ok: health.ok,
    productCount: health.productCount,
    issues: health.issues,
    emailed,
    checkedAt: health.checkedAt,
  });
}

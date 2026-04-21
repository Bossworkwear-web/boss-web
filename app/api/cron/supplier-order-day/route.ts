import { NextResponse } from "next/server";

import { getPerthYmd } from "@/lib/perth-calendar";
import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Ensures today’s supplier worksheet (Australia/Perth calendar) has at least one line in the DB.
 * Schedule: 8:30 AM Perth = 00:30 UTC — see `vercel.json` crons.
 *
 * GET /api/cron/supplier-order-day
 * Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ymd: listDate } = getPerthYmd();

  try {
    const supabase = createSupabaseAdminClient();

    const { data: existing, error: selectError } = await supabase
      .from("supplier_order_lines")
      .select("id")
      .eq("list_date", listDate)
      .limit(1);

    if (selectError) {
      const missing =
        selectError.message.includes("supplier_order_lines") ||
        selectError.message.includes("does not exist") ||
        selectError.code === "42P01" ||
        selectError.message.includes("list_date");
      return NextResponse.json(
        {
          error: missing
            ? "Missing supplier_order_lines or list_date — run migrations 20260427 and 20260428."
            : selectError.message,
        },
        { status: 500 },
      );
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({
        ok: true,
        list_date: listDate,
        created: false,
        reason: "already_has_rows",
      });
    }

    const insertRow: Database["public"]["Tables"]["supplier_order_lines"]["Insert"] = { list_date: listDate };
    const { error: insertError } = await supabase.from("supplier_order_lines").insert(insertRow);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      list_date: listDate,
      created: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

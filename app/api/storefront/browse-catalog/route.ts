import { NextResponse } from "next/server";

import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";

/** Slim browse catalog for client-side category filtering (Option B). */
export async function GET() {
  try {
    const rows = await getCachedActiveProductsBrowseRows();
    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog fetch failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

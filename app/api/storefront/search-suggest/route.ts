import { NextResponse } from "next/server";

import { getStorefrontSearchSuggestions } from "@/lib/storefront-search-suggest";

/** Debounced header autocomplete: `GET /api/storefront/search-suggest?q=polo&limit=8`. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "8", 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 8;
    const suggestions = await getStorefrontSearchSuggestions(q, limit);
    return NextResponse.json(
      { suggestions },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search suggest failed";
    return NextResponse.json({ error: message, suggestions: [] }, { status: 503 });
  }
}

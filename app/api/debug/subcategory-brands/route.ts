import { NextResponse } from "next/server";

import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";
import { filterProductsForSubCategoryBrowse } from "@/lib/main-category-browse";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const main = (url.searchParams.get("main") ?? "").trim();
  const sub = (url.searchParams.get("sub") ?? "").trim();
  if (!main || !sub) {
    return NextResponse.json(
      { ok: false, error: "Missing ?main=<slug>&sub=<subSlug>" },
      { status: 400 },
    );
  }

  const all = await getCachedActiveProductsBrowseRows();
  const filtered = filterProductsForSubCategoryBrowse(main, sub, all);
  const counts = new Map<string, number>();
  for (const r of filtered) {
    const b = String(r.supplier_name ?? "").trim() || "(blank)";
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const brands = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return NextResponse.json({
    ok: true,
    total_rows: all.length,
    filtered_rows: filtered.length,
    brands,
    sample: filtered.slice(0, 10).map((r) => ({
      name: r.name,
      slug: r.slug,
      supplier_name: r.supplier_name ?? null,
      category: r.category ?? null,
      base_price: r.base_price,
    })),
  });
}


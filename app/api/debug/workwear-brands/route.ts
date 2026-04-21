import { NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/supabase";

function inferredBrandForFilter(item: {
  supplier_name?: string | null;
  name: string;
  slug?: string | null;
  description?: string | null;
}): string {
  const direct = String(item.supplier_name ?? "").trim();
  if (direct) {
    return direct;
  }
  const hay = `${item.name} ${item.slug ?? ""} ${item.description ?? ""}`.toLowerCase();
  if (hay.includes("syzmik")) return "Syzmik";
  if (hay.includes("bisley")) return "Bisley";
  if (hay.includes("jb-") || hay.includes("jbs")) return "JB's Wear";
  return "";
}

export async function GET() {
  const supabase = createSupabaseClient();

  const pageSize = 1000;
  const maxScan = 25_000;
  const list: Array<{
    id: string;
    name: string;
    slug?: string | null;
    description?: string | null;
    base_price: number | null;
    is_active: boolean;
    supplier_name?: string | null;
  }> = [];

  for (let offset = 0; offset < maxScan; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, base_price, is_active, supplier_name")
      .eq("is_active", true)
      .order("name")
      .range(offset, offset + pageSize - 1);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const chunk = data ?? [];
    list.push(...chunk);
    if (chunk.length < pageSize) {
      break;
    }
  }
  const brands = new Map<string, number>();
  let syzmik = 0;
  let bisley = 0;

  for (const r of list) {
    const b = inferredBrandForFilter(r).trim();
    if (b) {
      brands.set(b, (brands.get(b) ?? 0) + 1);
    }
    const lower = b.toLowerCase();
    if (lower === "syzmik") syzmik += 1;
    if (lower === "bisley") bisley += 1;
  }

  const sortedBrands = [...brands.entries()].sort((a, b) => b[1] - a[1]);

  return NextResponse.json({
    ok: true,
    active_rows_returned: list.length,
    syzmik_count: syzmik,
    bisley_count: bisley,
    brands: sortedBrands,
    sample_first_5: list.slice(0, 5).map((r) => ({
      name: r.name,
      slug: r.slug,
      supplier_name: r.supplier_name,
      inferred: inferredBrandForFilter(r),
      base_price: r.base_price,
    })),
  });
}


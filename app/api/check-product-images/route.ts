import { NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseClient();

    const { data: sample, error: sampleError } = await supabase
      .from("products")
      .select("*")
      .limit(1);

    if (sampleError) {
      return NextResponse.json(
        {
          error: sampleError.message,
          hint: "Query failed - table or column may not exist.",
        },
        { status: 500 }
      );
    }

    if (!sample || sample.length === 0) {
      return NextResponse.json({
        columns: [],
        hasImageUrlsColumn: false,
        productCount: 0,
        productsWithImages: 0,
        sample: [],
        message: "No products in table.",
      });
    }

    const columns = Object.keys(sample[0]);
    const hasImageUrlsColumn = columns.includes("image_urls");

    const selectFields = hasImageUrlsColumn ? "id, name, image_urls" : "id, name";
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(selectFields)
      .limit(20);

    let productsWithImages = 0;
    if (!productsError && products && hasImageUrlsColumn) {
      const rows = products as unknown as { image_urls?: string[] | null }[];
      productsWithImages = rows.filter(
        (p) => Boolean(p.image_urls && Array.isArray(p.image_urls) && p.image_urls.length > 0)
      ).length;
    }

    return NextResponse.json({
      columns,
      hasImageUrlsColumn,
      selectImageUrlsError: productsError?.message ?? null,
      productCount: products?.length ?? 0,
      productsWithImages,
      sample: products?.slice(0, 5) ?? [],
      message: hasImageUrlsColumn
        ? `image_urls column exists. ${productsWithImages} of ${products?.length ?? 0} sampled products have images.`
        : "image_urls column NOT found in products table.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

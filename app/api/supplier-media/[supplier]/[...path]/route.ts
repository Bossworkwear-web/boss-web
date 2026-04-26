import { NextResponse } from "next/server";

import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ supplier: string; path?: string[] }> },
) {
  const { supplier, path: segments } = await context.params;
  if (!supplier || !segments?.length) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (process.env.VERCEL) {
    const bucket = process.env.SUPPLIER_IMAGES_BUCKET ?? "supplier-product-images";
    const objectPath = [supplier, ...segments].join("/").replace(/\/+/g, "/");
    const url = publicStorageObjectUrl(bucket, objectPath);
    if (!url) {
      return new NextResponse("Storage not configured", { status: 503 });
    }
    return NextResponse.redirect(url, 307);
  }

  const { getSupplierMediaFromDisk } = await import("./supplier-media-local");
  return getSupplierMediaFromDisk(supplier, segments, MIME);
}

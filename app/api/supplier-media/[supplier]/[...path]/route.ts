import { readFile } from "fs/promises";
import { extname, resolve } from "path";

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

  /** Vercel: never bundle `data/supplier/**` into this function (1GB+); images live in Supabase Storage. */
  if (process.env.VERCEL) {
    const bucket = process.env.SUPPLIER_IMAGES_BUCKET ?? "supplier-product-images";
    const objectPath = [supplier, ...segments].join("/").replace(/\/+/g, "/");
    const url = publicStorageObjectUrl(bucket, objectPath);
    if (!url) {
      return new NextResponse("Storage not configured", { status: 503 });
    }
    return NextResponse.redirect(url, 307);
  }

  const root = resolve(process.cwd(), "data", "supplier", supplier);
  const filePath = resolve(root, ...segments);

  if (!filePath.startsWith(root)) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  try {
    const buf = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

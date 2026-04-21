import { readFile } from "fs/promises";
import { extname, join, resolve } from "path";

import { NextResponse } from "next/server";

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

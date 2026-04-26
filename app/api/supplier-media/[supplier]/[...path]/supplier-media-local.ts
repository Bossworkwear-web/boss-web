/* Local-only file read (not used on Vercel). Turbopack may log “overly broad patterns”; that is a warning, not a failed build. */
import { readFile } from "fs/promises";
import { extname, resolve } from "path";

import { NextResponse } from "next/server";

export async function getSupplierMediaFromDisk(
  supplier: string,
  segments: string[],
  mime: Record<string, string>,
) {
  const root = resolve(process.cwd(), "data", "supplier", supplier);
  const filePath = resolve(root, ...segments);

  if (!filePath.startsWith(root)) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  try {
    const buf = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = mime[ext] ?? "application/octet-stream";
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

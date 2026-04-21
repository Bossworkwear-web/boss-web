import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { isAdminSession } from "@/lib/admin-auth";

const CATEGORIES = new Set(["TEE", "Vest", "Polo", "Shirt", "Jacket"]);

function parseSafeBasename(raw: string): string | null {
  let name = raw.trim();
  if (!name || name.length > 255) {
    return null;
  }
  try {
    name = decodeURIComponent(name);
  } catch {
    return null;
  }
  if (name.includes("\0") || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return null;
  }
  const base = path.basename(name);
  if (base !== name) {
    return null;
  }
  return name;
}

function mimeForFile(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".bmp":
      return "image/bmp";
    case ".avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

export async function GET(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") ?? "").trim();
  const nameRaw = searchParams.get("name") ?? "";
  const name = parseSafeBasename(nameRaw);

  if (!CATEGORIES.has(category) || !name) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const root = path.resolve(process.cwd(), "public", "Mock_up", category);
  const resolved = path.resolve(root, name);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  try {
    const buf = await readFile(resolved);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mimeForFile(name),
        "Cache-Control": "private, max-age=120",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

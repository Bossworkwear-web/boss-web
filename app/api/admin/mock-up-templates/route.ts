import { readdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { isAdminSession } from "@/lib/admin-auth";

const CATEGORIES = new Set(["TEE", "Vest", "Polo", "Shirt", "Jacket"]);
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

export async function GET(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") ?? "").trim();
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "Mock_up", category);
  try {
    const names = (await readdir(dir)).filter((n) => IMAGE_EXT.test(n) && !n.startsWith("."));
    names.sort((a, b) => a.localeCompare(b));
    const urls = names.map(
      (n) =>
        `/api/admin/mock-up-templates/file?category=${encodeURIComponent(category)}&name=${encodeURIComponent(n)}`,
    );
    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json({ urls: [] });
  }
}

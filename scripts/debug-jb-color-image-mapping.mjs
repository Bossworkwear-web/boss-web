#!/usr/bin/env node
/**
 * Debug JB's Wear colour ↔ image mapping inputs (DB only):
 * - products.available_colors
 * - products.image_urls (and whether `#jbpc=N` is present)
 *
 * Usage:
 *   node scripts/debug-jb-color-image-mapping.mjs --limit=30
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (see `.env.local`).
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

function parseArgs(argv) {
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, Math.floor(Number(limitArg.split("=")[1]) || 0)) : 25;
  const onlySlugArg = argv.find((a) => a.startsWith("--slug="));
  const onlySlug = onlySlugArg ? String(onlySlugArg.slice("--slug=".length)).trim() : "";
  return { limit, onlySlug };
}

function jbpcFromFirstUrl(urls) {
  const first = Array.isArray(urls) && typeof urls[0] === "string" ? urls[0] : "";
  const m = /#jbpc=(\d+)$/i.exec(first);
  if (!m?.[1]) return 0;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let q = supabase
    .from("products")
    .select("id, name, slug, supplier_name, available_colors, image_urls, storefront_hidden, is_active")
    .eq("supplier_name", "JB's Wear")
    .eq("is_active", true)
    .order("name")
    .limit(args.limit);
  if (args.onlySlug) {
    q = q.eq("slug", args.onlySlug);
  }
  const { data, error } = await q;
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const rows = data ?? [];
  console.log(`Rows: ${rows.length}`);
  for (const r of rows) {
    const colors = Array.isArray(r.available_colors) ? r.available_colors.map((c) => String(c).trim()).filter(Boolean) : [];
    const urls = Array.isArray(r.image_urls) ? r.image_urls.map((u) => String(u)) : [];
    const jbpc = jbpcFromFirstUrl(urls);
    const first3 = urls.slice(0, 3).map((u) => (u.length > 90 ? `${u.slice(0, 87)}…` : u));
    console.log("");
    console.log(`- ${r.slug} :: ${r.name}`);
    console.log(`  colors(${colors.length}): ${colors.slice(0, 8).join(" | ")}${colors.length > 8 ? " | …" : ""}`);
    console.log(`  image_urls(${urls.length}) jbpc=${jbpc}`);
    console.log(`  first: ${first3.join(" ; ")}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});


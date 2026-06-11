/**
 * Re-order DNC `available_colors` and `image_urls` so colour chips align with gallery heroes.
 *
 * Usage:
 *   node scripts/backfill-dnc-color-images.mjs --dry-run
 *   node scripts/backfill-dnc-color-images.mjs --slug=dnc-3864
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildGroupedProducts } from "./import-dnc-csv.mjs";
import { remapDncImageOrder } from "./lib/dnc-color-images.mjs";
import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

const DEFAULT_CSV = "data/supplier/dnc/product-details.csv";
const SUPPLIER_NAME = "DNC Workwear";

function parseArgs(argv) {
  const out = { dryRun: false, slug: null, limit: Infinity };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a.startsWith("--slug=")) {
      out.slug = a.slice("--slug=".length).trim().toLowerCase() || null;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      out.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
    }
  }
  return out;
}

/** RFC4180-ish CSV parser (same as import-dnc-csv.mjs). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }
    if (c === "\r") {
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = getBossWebRoot();
  const csvPath = resolve(root, DEFAULT_CSV);
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const { productRows } = buildGroupedProducts(rows);
  const bySlug = new Map(productRows.map((r) => [r.slug, r]));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = supabase
    .from("products")
    .select("id, slug, available_colors, image_urls")
    .eq("supplier_name", SUPPLIER_NAME)
    .eq("is_active", true);

  if (args.slug) {
    query = query.eq("slug", args.slug);
  }

  const { data: products, error } = await query;
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const targets = (products ?? []).slice(0, args.limit);
  let changed = 0;
  let skipped = 0;

  for (const p of targets) {
    const slug = String(p.slug ?? "").trim().toLowerCase();
    const source = bySlug.get(slug);
    if (!source?.available_colors?.length || !source.image_urls?.length) {
      skipped += 1;
      continue;
    }

    const existingUrls = Array.isArray(p.image_urls) ? p.image_urls.map(String) : [];
    const newImageUrls = remapDncImageOrder(source.image_urls, existingUrls);
    const newColors = source.available_colors;

    const oldColors = Array.isArray(p.available_colors) ? p.available_colors.map(String) : [];
    if (arraysEqual(oldColors, newColors) && arraysEqual(existingUrls, newImageUrls)) {
      skipped += 1;
      continue;
    }

    changed += 1;
    console.log(
      `${slug}: colours ${JSON.stringify(oldColors)} → ${JSON.stringify(newColors)}; images ${existingUrls.length} → ${newImageUrls.length}`,
    );

    if (!args.dryRun) {
      const { error: upErr } = await supabase
        .from("products")
        .update({
          available_colors: newColors,
          image_urls: newImageUrls,
        })
        .eq("id", p.id);
      if (upErr) {
        console.error(`Update failed for ${slug}:`, upErr.message);
        process.exit(1);
      }
    }
  }

  console.log(
    `\nDone. ${changed} updated, ${skipped} unchanged/skipped (${targets.length} scanned)` +
      (args.dryRun ? " [dry-run]" : ""),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

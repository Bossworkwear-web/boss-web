/**
 * Set `products.category` for JB's Wear rows whose style code starts with `6` (e.g. 6RKB)
 * to a Workwear-safe label so they list under /categories/workwear (see `isJbWearSixSeriesListing`).
 *
 * Usage:
 *   node scripts/move-jb-six-series-workwear.mjs --dry-run
 *   node scripts/move-jb-six-series-workwear.mjs
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

const TRAILING_STYLE_PAREN_RE = /\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/;

function parseArgs(argv) {
  let dryRun = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
  }
  return { dryRun };
}

function jbCatalogSubslug(slug) {
  const s = String(slug ?? "").trim().toLowerCase();
  if (!s) return null;
  const atEnd = /(?:^|-)(jb-[a-z0-9][a-z0-9_-]*)$/i.exec(s);
  if (atEnd) return atEnd[1].toLowerCase();
  const anywhere = /(?:^|-)(jb-[a-z0-9][a-z0-9_-]*)/i.exec(s);
  return anywhere ? anywhere[1].toLowerCase() : null;
}

function jbStyleCodeFromSlug(slug) {
  const seg = jbCatalogSubslug(slug);
  if (!seg) return null;
  const m = /^jb-(.+)$/.exec(seg);
  if (!m) return null;
  const parts = m[1].split("-").filter(Boolean);
  const tail = parts.length ? parts[parts.length - 1] : "";
  if (/^[a-z0-9]{3,20}$/i.test(tail)) {
    return tail.toUpperCase();
  }
  return m[1].replace(/-/g, "").toUpperCase();
}

function styleCodeFromRow(row) {
  const fromSlug = jbStyleCodeFromSlug(String(row.slug ?? ""));
  if (fromSlug) return fromSlug;
  const n = String(row.name ?? "").trim();
  const p = n.match(TRAILING_STYLE_PAREN_RE);
  return p ? p[1].toUpperCase() : null;
}

function dbCategoryJbSixWorkwear(category, subCategory, name) {
  const c = String(category ?? "").toLowerCase();
  const sc = String(subCategory ?? "").toLowerCase();
  const n = String(name ?? "").toLowerCase();
  const hay = `${c} ${sc} ${n}`;

  if (hay.includes("polo")) return "Polos";
  if (hay.includes("tee") || hay.includes("t-shirt") || hay.includes("t shirts") || hay.includes("singlet")) {
    return "T-shirts";
  }
  if (hay.includes("shirt")) return "Shirts";
  if (hay.includes("jacket") || hay.includes("hoodie") || hay.includes("fleece") || hay.includes("softshell")) {
    return "Jackets";
  }
  if (hay.includes("pant") || hay.includes("trouser") || hay.includes("short")) return "Pants";
  if (hay.includes("scrub")) return "T-shirts";
  if (hay.includes("boot") || hay.includes("glove") || hay.includes("glass") || hay.includes("goggle")) {
    return "T-shirts";
  }
  if (/\b(hat|cap|beanie|helmet|hard hat|balaclava|headwear|head wear)\b/.test(hay)) return "Jackets";
  return "T-shirts";
}

async function fetchJbRows(supabase) {
  const pageSize = 500;
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, category, description")
      .eq("supplier_name", "JB's Wear")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return out;
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows = await fetchJbRows(supabase);
  const targets = [];
  for (const row of rows) {
    const code = styleCodeFromRow(row);
    if (!code || !code.startsWith("6")) continue;
    const blob = `${String(row.category ?? "")} ${String(row.name ?? "")} ${String(row.description ?? "").slice(0, 600)}`;
    const nextCat = dbCategoryJbSixWorkwear("", "", blob);
    if (String(row.category ?? "").trim() === nextCat) {
      continue;
    }
    targets.push({ row, code, nextCat });
  }

  console.log(`JB's Wear rows: ${rows.length}, style code starting with 6 to update: ${targets.length}`);

  let updated = 0;
  const batch = [];
  for (const { row, code, nextCat } of targets) {
    if (dryRun) {
      console.log("—", row.id, code, "|", JSON.stringify(row.category), "→", nextCat, "|", String(row.name).slice(0, 70));
      updated += 1;
      continue;
    }
    batch.push({ id: row.id, category: nextCat });
    if (batch.length >= 40) {
      const { error } = await supabase.from("products").upsert(batch, { onConflict: "id" });
      if (error) throw error;
      updated += batch.length;
      batch.length = 0;
    }
  }
  if (!dryRun && batch.length) {
    const { error } = await supabase.from("products").upsert(batch, { onConflict: "id" });
    if (error) throw error;
    updated += batch.length;
  }

  console.log(dryRun ? `Dry-run: would update ${updated} categories` : `Updated ${updated} categories`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

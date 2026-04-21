/**
 * Fix JB's Wear rows where `products.name` accidentally holds long copy (belongs in `description`)
 * and the storefront "code" line showed the wrong string.
 *
 * For each JB row:
 * - Prepend the current `name` to `description` (keeps existing description after a blank line).
 * - Set `name` to `JB's Wear {short title} ({STYLE})` where STYLE is taken from trailing `(…)` or from `slug` jb-…
 *
 * Usage:
 *   node scripts/fix-jb-product-name-description.mjs --dry-run
 *   node scripts/fix-jb-product-name-description.mjs
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

function parseArgs(argv) {
  let dryRun = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
  }
  return { dryRun };
}

/** Trailing `(5CCP1)` / `(BS-123)` style segment at end of `products.name`. */
const TRAILING_STYLE_PAREN_RE = /\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/;

function styleCodeFromSlug(slug) {
  const s = String(slug ?? "").trim().toLowerCase();
  const m = /^jb-(.+)$/.exec(s);
  if (!m) return null;
  const parts = m[1].split("-").filter(Boolean);
  const tail = parts.length ? parts[parts.length - 1] : "";
  if (/^[a-z0-9]{3,20}$/i.test(tail)) {
    return tail.toUpperCase();
  }
  return m[1].replace(/-/g, "").toUpperCase();
}

function stripJbBrandPrefix(s) {
  return String(s ?? "")
    .trim()
    .replace(/^jb'?s\s+wear\s+/i, "")
    .trim();
}

function firstUsableDescriptionLine(desc) {
  const t = String(desc ?? "").trim();
  if (!t) return "";
  const line = t.split(/\r?\n/).map((l) => l.trim())[0] ?? "";
  if (line.length < 6 || line.length > 220) return "";
  return line;
}

function buildNewFields(row) {
  const oldName = String(row.name ?? "").trim();
  const oldDesc = String(row.description ?? "").trim();
  const slug = String(row.slug ?? "").trim();

  const paren = oldName.match(TRAILING_STYLE_PAREN_RE);
  const codeFromParen = paren ? paren[1].toUpperCase() : null;
  const codeFromSlug = styleCodeFromSlug(slug);
  const styleCode = codeFromParen ?? codeFromSlug;
  if (!styleCode) {
    return { skip: true, reason: "no style code from (…) or jb- slug" };
  }

  const beforeParen = paren ? oldName.slice(0, paren.index).trim() : oldName;
  let titlePart = stripJbBrandPrefix(beforeParen);

  const descLead = firstUsableDescriptionLine(oldDesc);
  if (titlePart.length > 200 && descLead) {
    titlePart = descLead;
  } else if (titlePart.length > 200) {
    titlePart = titlePart.slice(0, 180).replace(/\s+\S*$/, "").trim();
  }

  if (!titlePart) {
    titlePart = `Style ${styleCode}`;
  }

  const newDescription = [oldName, oldDesc].filter(Boolean).join("\n\n").trim();
  const newName = `JB's Wear ${titlePart} (${styleCode})`;

  if (newName === oldName && newDescription === oldDesc) {
    return { skip: true, reason: "already normalized" };
  }

  return { skip: false, newName, newDescription };
}

async function fetchAllJbRows(supabase) {
  const pageSize = 500;
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, supplier_name")
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

  const rows = await fetchAllJbRows(supabase);
  console.log(`Found ${rows.length} JB's Wear rows (supplier_name = JB's Wear)`);

  let updated = 0;
  let skipped = 0;
  const batch = [];

  for (const row of rows) {
    const plan = buildNewFields(row);
    if (plan.skip) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log("—", row.id);
      console.log("  old name:", String(row.name).slice(0, 120) + (String(row.name).length > 120 ? "…" : ""));
      console.log("  new name:", plan.newName.slice(0, 140) + (plan.newName.length > 140 ? "…" : ""));
      console.log("  desc len:", plan.newDescription.length);
      updated += 1;
      continue;
    }
    batch.push({ id: row.id, name: plan.newName, description: plan.newDescription });
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

  console.log(dryRun ? `Dry-run: would update ${updated}, skip ${skipped}` : `Updated ${updated}, skip ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

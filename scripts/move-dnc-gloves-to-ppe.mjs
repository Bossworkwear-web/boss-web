/**
 * Set DNC glove catalogue rows to category `Glove` (PPE → Glove browse routing).
 *
 * Usage:
 *   node scripts/move-dnc-gloves-to-ppe.mjs --dry-run
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

import { isDncPpeGloveProductRow } from "./lib/dnc-glove-routing.mjs";
import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

const SUPPLIER_NAME = "DNC Workwear";
const TARGET_CATEGORY = "Glove";

function parseArgs(argv) {
  const out = { dryRun: false };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, category, is_active")
    .eq("supplier_name", SUPPLIER_NAME);
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const targets = (data ?? []).filter(
    (row) => isDncPpeGloveProductRow(row) && String(row.category ?? "").trim() !== TARGET_CATEGORY,
  );

  console.log(`Found ${targets.length} DNC glove row(s) to recategorize → ${TARGET_CATEGORY}`);
  for (const row of targets.sort((a, b) => String(a.slug).localeCompare(String(b.slug)))) {
    console.log(`  ${row.slug}: ${row.category ?? "(none)"} → ${TARGET_CATEGORY}`);
  }

  if (args.dryRun) {
    console.log("\nDry run — no database changes.");
    return;
  }

  let ok = 0;
  for (const row of targets) {
    const { error: upErr } = await supabase
      .from("products")
      .update({ category: TARGET_CATEGORY })
      .eq("id", row.id);
    if (upErr) {
      console.error(`Update failed for ${row.slug}:`, upErr.message);
      process.exit(1);
    }
    ok += 1;
  }
  console.log(`\nDone. Updated ${ok} row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

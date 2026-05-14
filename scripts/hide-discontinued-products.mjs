/**
 * Hide discontinued products from the storefront by setting `products.storefront_hidden = true`.
 *
 * Rules:
 * - Always hide rows with `is_active = false`
 * - Also hide rows whose `name` or `description` contains "discontinued" (case-insensitive)
 * - Also hide rows where any `available_colors` chip/label contains "discontinued" (case-insensitive)
 *   (matches PDP colour chips like "Navy (Discontinued)" or "Discontinued — Olive")
 *
 * Usage:
 *   node scripts/hide-discontinued-products.mjs --dry-run
 *   node scripts/hide-discontinued-products.mjs
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (preferred; anon key may fail under RLS)
 */
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
  };
}

function envRequired(name) {
  const v = process.env[name];
  if (v && String(v).trim()) {
    return String(v).trim();
  }
  throw new Error(`Missing env ${name}`);
}

/** True if any storefront colour chip string mentions discontinued. */
function availableColorsHasDiscontinued(availableColors) {
  if (availableColors == null) {
    return false;
  }
  const list = Array.isArray(availableColors) ? availableColors : [];
  return list.some((c) => /discontinued/i.test(String(c ?? "")));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = envRequired("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    (process.env.SUPABASE_SERVICE_ROLE_KEY && String(process.env.SUPABASE_SERVICE_ROLE_KEY).trim()) ||
    envRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const PAGE = 1000;
  const maxScan = 200_000;
  const candidates = [];

  for (let offset = 0; offset < maxScan; offset += PAGE) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, is_active, storefront_hidden, available_colors")
      .range(offset, offset + PAGE - 1);
    if (error) {
      throw error;
    }
    if (!data?.length) {
      break;
    }
    for (const row of data) {
      const name = String(row.name ?? "");
      const desc = String(row.description ?? "");
      const isActive = row.is_active !== false;
      const flaggedText = /discontinued/i.test(name) || /discontinued/i.test(desc);
      const flaggedColors = availableColorsHasDiscontinued(row.available_colors);
      const shouldHide = !isActive || flaggedText || flaggedColors;
      if (shouldHide && !row.storefront_hidden) {
        const reason = !isActive
          ? "is_active=false"
          : flaggedColors
            ? "colors:discontinued"
            : "text:discontinued";
        candidates.push({
          id: row.id,
          reason,
          name,
        });
      }
    }
    if (data.length < PAGE) {
      break;
    }
  }

  console.log(`Found ${candidates.length} products to hide.`);
  for (const c of candidates.slice(0, 25)) {
    console.log(`- [${c.reason}] ${c.name} (${c.id})`);
  }
  if (candidates.length > 25) {
    console.log(`… and ${candidates.length - 25} more`);
  }

  if (args.dryRun) {
    console.log("Dry run: no updates applied.");
    return;
  }

  const ids = candidates.map((c) => c.id);
  if (!ids.length) {
    console.log("Nothing to update.");
    return;
  }

  // Update in chunks to avoid payload limits.
  const BATCH = 500;
  let updated = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error } = await supabase
      .from("products")
      .update({ storefront_hidden: true, storefront_hidden_at: new Date().toISOString() })
      .in("id", batch);
    if (error) {
      throw error;
    }
    updated += batch.length;
    process.stdout.write(`\rHidden ${updated}/${ids.length}`);
  }
  process.stdout.write("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


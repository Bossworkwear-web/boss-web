/**
 * Force Bisley BJ6976 storefront retail to a target by adjusting `products.base_price`.
 *
 * Current store pricing:
 * - Retail (GST incl.) = base_price × (markup × (1 + GST))
 * - Rounded to 1 decimal place in `lib/product-price.ts`
 *
 * Usage:
 *   node scripts/set-bisley-bj6976-retail.mjs --target=101.4 --dry-run
 *   node scripts/set-bisley-bj6976-retail.mjs --target=101.4
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

// Keep in sync with `lib/product-price.ts` for now (Node scripts don't load TS path aliases).
const MARKUP_BEFORE_GST = 1.8;
const GST_RATE = 0.1;
const STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER = MARKUP_BEFORE_GST * (1 + GST_RATE); // 1.98

function roundToStorePrice(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

function parseArgs(argv) {
  const out = { target: 101.4, dryRun: false };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a.startsWith("--target=")) {
      const n = Number(a.slice("--target=".length));
      if (Number.isFinite(n) && n > 0) {
        out.target = n;
      }
    }
  }
  return out;
}

function candidateBasePrices(target) {
  // We round retail to 1 dp, so pick a base that lands exactly on target after rounding.
  const ideal = target / STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER;
  const out = [];
  // Search around the ideal in 0.01 steps (base_price is typically stored at cents).
  for (let i = -200; i <= 200; i += 1) {
    const base = Math.round((ideal + i * 0.01) * 100) / 100;
    if (base <= 0) continue;
    const retail = roundToStorePrice(base * STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER);
    if (retail === roundToStorePrice(target)) {
      out.push(base);
    }
    if (out.length >= 10) break;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const code = "BJ6976";
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, supplier_name, base_price")
    .ilike("supplier_name", "%bisley%")
    .or(`name.ilike.%${code}%,slug.ilike.%${code.toLowerCase()}%`);

  if (error) {
    throw error;
  }

  const rows = (data ?? []).filter((r) => r && typeof r === "object" && "id" in r);
  if (rows.length === 0) {
    console.error("No matching Bisley BJ6976 product found.");
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error("Multiple matches found; refusing to update automatically.");
    for (const r of rows) {
      console.error("-", r.id, r.slug, r.base_price, r.name);
    }
    process.exit(1);
  }

  const row = rows[0];
  const candidates = candidateBasePrices(args.target);
  const chosen = candidates[0] ?? Math.round((args.target / STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER) * 100) / 100;
  const retail = roundToStorePrice(chosen * STOREFRONT_RETAIL_MULTIPLIER_FROM_SUPPLIER);

  console.log("Target retail:", args.target);
  console.log("Chosen base_price:", chosen);
  console.log("Result retail (rounded 1dp):", retail);
  console.log("Row:", row.id, row.slug, row.base_price, row.name);

  if (args.dryRun) {
    return;
  }

  const { error: upErr } = await supabase.from("products").update({ base_price: chosen }).eq("id", row.id);
  if (upErr) {
    throw upErr;
  }
  console.log("Updated base_price.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


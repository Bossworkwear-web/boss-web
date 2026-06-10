#!/usr/bin/env node
/**
 * Hide products that have no images (`image_urls` null/empty) from the storefront.
 *
 * Sets `products.storefront_hidden = true` (does NOT delete data).
 *
 * Usage:
 *   node scripts/hide-products-without-images.mjs --dry-run
 *   node scripts/hide-products-without-images.mjs --apply
 *   node scripts/hide-products-without-images.mjs --apply --supplier="DNC Workwear"
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (see `.env.local`).
 */
import { createClient } from "@supabase/supabase-js";

import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run") || !argv.includes("--apply");
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, Math.floor(Number(limitArg.split("=")[1]) || 0)) : 0;
  const includeInactive = argv.includes("--include-inactive");
  const supplierArg = argv.find((a) => a.startsWith("--supplier="));
  const supplier = supplierArg ? supplierArg.slice("--supplier=".length).trim() || null : null;
  return { dryRun, limit, includeInactive, supplier };
}

function normalizedImageUrls(imageUrls) {
  if (!Array.isArray(imageUrls)) return [];
  return imageUrls.map((u) => String(u ?? "").trim()).filter(Boolean);
}

function hasAnyImage(imageUrls) {
  return normalizedImageUrls(imageUrls).length > 0;
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

  const pageSize = 500;
  let from = 0;
  let scanned = 0;
  const targets = [];

  while (true) {
    let q = supabase
      .from("products")
      .select("id, name, slug, image_urls, storefront_hidden, is_active")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (!args.includeInactive) {
      q = q.eq("is_active", true);
    }
    if (args.supplier) {
      q = q.eq("supplier_name", args.supplier);
    }
    const { data, error } = await q;
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    const rows = data ?? [];
    scanned += rows.length;

    for (const row of rows) {
      if (row.storefront_hidden) continue;
      if (!hasAnyImage(row.image_urls)) {
        targets.push({ id: row.id, name: row.name, slug: row.slug, is_active: row.is_active });
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
    if (args.limit > 0 && scanned >= args.limit) break;
  }

  console.log(`Scanned ${scanned} product(s).${args.supplier ? ` Supplier filter: ${args.supplier}` : ""}`);
  console.log(`Found ${targets.length} product(s) with no images and not currently hidden.`);

  if (targets.length) {
    console.log("Sample (up to 30):");
    for (const t of targets.slice(0, 30)) {
      console.log(`- [${t.id}] ${t.name}${t.slug ? ` (${t.slug})` : ""}`);
    }
  }

  if (args.dryRun) {
    console.log("Dry run only (pass --apply to write updates).");
    return;
  }

  let updated = 0;
  const chunkSize = 200;
  for (let i = 0; i < targets.length; i += chunkSize) {
    const chunk = targets.slice(i, i + chunkSize);
    const ids = chunk.map((t) => t.id);
    const hiddenAt = new Date().toISOString();
    const { error } = await supabase
      .from("products")
      .update({ storefront_hidden: true, storefront_hidden_at: hiddenAt })
      .in("id", ids);
    if (error) {
      console.error("Update failed:", error.message);
      process.exit(1);
    }
    updated += ids.length;
  }

  console.log(`Updated ${updated} product(s): storefront_hidden=true`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});


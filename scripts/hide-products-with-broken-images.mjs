#!/usr/bin/env node
/**
 * Hide products whose `image_urls` are all unreachable (404, timeout, etc.).
 *
 * Usage:
 *   node scripts/hide-products-with-broken-images.mjs --dry-run --supplier="DNC Workwear"
 *   node scripts/hide-products-with-broken-images.mjs --apply --supplier="DNC Workwear"
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

const CHECK_TIMEOUT_MS = 12_000;
const URL_CONCURRENCY = 16;

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run") || !argv.includes("--apply");
  const supplierArg = argv.find((a) => a.startsWith("--supplier="));
  const supplier = supplierArg ? supplierArg.slice("--supplier=".length).trim() || null : null;
  const includeHidden = argv.includes("--include-hidden");
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, Math.floor(Number(limitArg.split("=")[1]) || 0)) : 0;
  return { dryRun, supplier, includeHidden, limit };
}

function normalizedImageUrls(imageUrls) {
  if (!Array.isArray(imageUrls)) return [];
  return imageUrls.map((u) => String(u ?? "").trim()).filter(Boolean);
}

async function checkImageUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "BossWorkwear-CatalogCheck/1.0" },
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "BossWorkwear-CatalogCheck/1.0",
          Range: "bytes=0-0",
        },
      });
    }
    return res.ok || (res.status >= 200 && res.status < 400);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
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
  const products = [];

  while (true) {
    let q = supabase
      .from("products")
      .select("id, name, slug, image_urls, storefront_hidden, is_active, supplier_name")
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (args.supplier) {
      q = q.eq("supplier_name", args.supplier);
    }
    if (!args.includeHidden) {
      q = q.eq("storefront_hidden", false);
    }
    const { data, error } = await q;
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    const rows = data ?? [];
    for (const row of rows) {
      const urls = normalizedImageUrls(row.image_urls);
      if (urls.length === 0) {
        continue;
      }
      products.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        urls,
      });
    }
    if (rows.length < pageSize) break;
    from += pageSize;
    if (args.limit > 0 && products.length >= args.limit) break;
  }

  const scoped = args.limit > 0 ? products.slice(0, args.limit) : products;
  const uniqueUrls = [...new Set(scoped.flatMap((p) => p.urls))];
  console.log(
    `Checking ${uniqueUrls.length} unique image URL(s) across ${scoped.length} visible product(s)` +
      (args.supplier ? ` [${args.supplier}]` : "") +
      "…",
  );

  const urlStatus = new Map();
  let checked = 0;
  await mapWithConcurrency(uniqueUrls, URL_CONCURRENCY, async (url) => {
    const ok = await checkImageUrl(url);
    urlStatus.set(url, ok);
    checked += 1;
    if (checked % 50 === 0 || checked === uniqueUrls.length) {
      process.stdout.write(`\rChecked URLs: ${checked}/${uniqueUrls.length}`);
    }
  });
  process.stdout.write("\n");

  const badUrlCount = [...urlStatus.values()].filter((v) => !v).length;
  console.log(`Broken URLs: ${badUrlCount}/${uniqueUrls.length}`);

  const targets = scoped.filter((p) => p.urls.every((u) => !urlStatus.get(u)));
  console.log(`Products with all image URLs broken: ${targets.length}`);

  if (targets.length) {
    console.log("Sample (up to 25):");
    for (const t of targets.slice(0, 25)) {
      const first = t.urls[0] ?? "";
      console.log(`- [${t.slug ?? t.id}] ${t.name}`);
      console.log(`    ${first}`);
    }
  }

  if (args.dryRun) {
    console.log("Dry run only (pass --apply to hide these products).");
    return;
  }

  const hiddenAt = new Date().toISOString();
  let updated = 0;
  const chunkSize = 100;
  for (let i = 0; i < targets.length; i += chunkSize) {
    const chunk = targets.slice(i, i + chunkSize);
    const ids = chunk.map((t) => t.id);
    const { error } = await supabase
      .from("products")
      .update({ storefront_hidden: true, storefront_hidden_at: hiddenAt })
      .in("id", ids);
    if (error) {
      console.error("Update failed:", error.message);
      process.exit(1);
    }
    updated += ids.length;
    process.stdout.write(`\rHidden ${updated}/${targets.length}`);
  }
  if (targets.length) {
    process.stdout.write("\n");
  }
  console.log(`Updated ${updated} product(s): storefront_hidden=true`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

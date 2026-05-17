#!/usr/bin/env node
/**
 * Patch Supabase `products.description` for Fashion Biz lines (Biz Care, Biz Collection, Yes Chef)
 * using sum CSVs in `data/supplier/fashion-biz/csv/` (`short_description`, `stringified_description`).
 *
 *   node scripts/update-biz-collection-descriptions-from-sum-csv.mjs --dry-run
 *   node scripts/update-biz-collection-descriptions-from-sum-csv.mjs
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (see `.env.local`).
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadFashionBizSumMarketingMaps } from "./lib/fashion-biz-sum-csv-maps.mjs";
import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

function parseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") };
}

function styleFromFashionBizName(name) {
  const m = /\b(?:Biz Care|Biz Collection|Yes\s*Chef)\s+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\b/i.exec(
    String(name ?? ""),
  );
  return m ? m[1].toUpperCase().replace(/-CLEARANCE$/i, "") : null;
}

function brandFromFashionBizName(name, supplierName) {
  const n = String(name ?? "");
  if (/\bYes\s*Chef\b/i.test(n) || String(supplierName ?? "").trim().toLowerCase() === "yes chef") {
    return "Yes Chef";
  }
  if (/\bBiz Collection\b/i.test(n) || String(supplierName ?? "").trim().toLowerCase() === "biz collection") {
    return "Biz Collection";
  }
  if (/\bBiz Care\b/i.test(n) || String(supplierName ?? "").trim().toLowerCase() === "biz care") {
    return "Biz Care";
  }
  return null;
}

function isFashionBizProduct(name, supplierName) {
  return Boolean(brandFromFashionBizName(name, supplierName));
}

function buildDescription(row, template, displayName, sumTitle, detailBody, style, brand) {
  const name = String(row.name ?? "");
  const baseDescription = template
    .replace(/\{name\}/g, name)
    .replace(/\{displayName\}/g, displayName)
    .replace(/\{section\}/g, String(row.category ?? "").trim())
    .replace(/\{brand\}/g, brand)
    .replace(/\{sku\}/g, style);
  const parts = [];
  if (sumTitle) {
    parts.push(sumTitle);
  }
  if (detailBody) {
    parts.push(detailBody);
  }
  parts.push(baseDescription);
  return parts.join("\n\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = getBossWebRoot();
  const cfgPath = join(root, "data", "supplier", "fashion-biz", "catalog.config.json");
  const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
  const template = String(cfg.descriptionTemplate ?? "{name} — {displayName} catalog ({section}).");
  const displayName = String(cfg.displayName ?? "Fashion Biz");

  const { shortByStyle, detailByStyle } = loadFashionBizSumMarketingMaps(root);
  console.log(
    `Loaded ${shortByStyle.size} short_description keys, ${detailByStyle.size} stringified_description keys from sum CSVs.`,
  );
  if (detailByStyle.size === 0) {
    console.warn(
      "No stringified_description column found in any *sum*.csv under data/supplier/fashion-biz/csv/. Add or fix CSV files there, then re-run.",
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let from = 0;
  const pageSize = 500;
  let updated = 0;
  let skipped = 0;
  let scanned = 0;
  let noCsvDetail = 0;

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, category, description, supplier_name")
      .or(
        "name.ilike.%Biz Care%,name.ilike.%Biz Collection%,name.ilike.%Yes Chef%,supplier_name.eq.Biz Care,supplier_name.eq.Biz Collection,supplier_name.eq.Yes Chef",
      )
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    if (!data?.length) {
      break;
    }
    for (const row of data) {
      scanned += 1;
      const nm = String(row.name ?? "");
      if (!isFashionBizProduct(nm, row.supplier_name)) {
        skipped += 1;
        continue;
      }
      const brand = brandFromFashionBizName(nm, row.supplier_name);
      if (!brand) {
        skipped += 1;
        continue;
      }
      const style = styleFromFashionBizName(nm);
      if (!style) {
        skipped += 1;
        continue;
      }
      const detailBody = (detailByStyle.get(style) ?? "").trim();
      if (!detailBody) {
        noCsvDetail += 1;
        skipped += 1;
        continue;
      }
      const sumTitle = (shortByStyle.get(style) ?? "").trim();
      const nextDesc = buildDescription(row, template, displayName, sumTitle, detailBody, style, brand);
      if (nextDesc === (row.description ?? "")) {
        skipped += 1;
        continue;
      }
      if (args.dryRun) {
        console.log(`[dry-run] ${brand} ${style} → ${row.slug}`);
        updated += 1;
        continue;
      }
      const { error: upErr } = await supabase.from("products").update({ description: nextDesc }).eq("id", row.id);
      if (upErr) {
        console.error("Update failed", row.id, upErr.message);
        process.exit(1);
      }
      updated += 1;
    }
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  console.log(
    `Done. rows scanned=${scanned}, descriptions ${args.dryRun ? "would update" : "updated"}=${updated}, skipped=${skipped}, no CSV detail=${noCsvDetail}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Import Blue Whale reseller Numbers workbook into Supabase `products`.
 *
 * Source file: data/supplier/blue-whale/2026-bluewhale-sku-reseller.numbers
 * Images:      data/supplier/blue-whale/images/<STYLE_CODE>/*.jpg
 *
 * Aggregates rows by `Style Code` (one storefront product per style),
 * collecting colours + sizes + image URLs and using min reseller price.
 *
 * Usage:
 *   node scripts/import-blue-whale-numbers.mjs --dry-run --limit=5
 *   node scripts/import-blue-whale-numbers.mjs
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnvLocal();

function parseArgs(argv) {
  const out = { dryRun: false, limit: Infinity, file: null };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      out.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
    } else if (a.startsWith("--file=")) {
      out.file = a.slice("--file=".length).trim() || null;
    }
  }
  return out;
}

function normalizeHeader(h) {
  return String(h ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSizeToken(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const up = s.toUpperCase();
  if (/^(?:ONE\s*SIZE|OS|O\/S|FREE)$/i.test(s)) return "One Size";
  if (/^\d+$/.test(s)) return String(Number.parseInt(s, 10));
  return up.replace(/\s+/g, "");
}

const SIZE_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
  "6XL",
  "7XL",
  "8XL",
  "One Size",
];
const SIZE_RANK = new Map(SIZE_ORDER.map((s, i) => [s, i]));

function sortSizesUnique(values) {
  const uniq = [...new Set(values.map((v) => String(v)).filter(Boolean))];
  uniq.sort((a, b) => {
    const ra = SIZE_RANK.get(a) ?? 999;
    const rb = SIZE_RANK.get(b) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
  return uniq;
}

function parsePrice(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeBrand(raw) {
  return String(raw ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProductName(raw) {
  return String(raw ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dbCategoryFromSheet(category, subCategory, name) {
  const hay = `${category ?? ""} ${subCategory ?? ""} ${name ?? ""}`.toLowerCase();
  if (hay.includes("polo")) return "Polos";
  if (hay.includes("tee") || hay.includes("t-shirt") || hay.includes("t shirts") || hay.includes("singlet")) {
    return "T-shirts";
  }
  if (hay.includes("shirt")) return "Shirts";
  if (hay.includes("jacket") || hay.includes("hoodie") || hay.includes("fleece") || hay.includes("softshell")) {
    return "Jackets";
  }
  if (hay.includes("jumper") || hay.includes("sweat") || hay.includes("knit")) return "Jumper";
  if (hay.includes("pant") || hay.includes("trouser") || hay.includes("short")) return "Pants";
  if (hay.includes("scrub")) return "Scrubs";
  if (hay.includes("boot")) return "Boots";
  if (hay.includes("glove")) return "Glove";
  if (hay.includes("glass") || hay.includes("goggle")) return "Safty Glasses";
  if (/\b(hat|cap|beanie|helmet|hard hat|balaclava|headwear|head wear)\b/.test(hay)) return "Head Wear";
  return "T-shirts";
}

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function localImageUrlsForStyle(root, styleCode) {
  const code = String(styleCode ?? "").trim();
  if (!code) return [];
  const dir = resolve(root, "data", "supplier", "blue-whale", "images", code);
  if (!existsSync(dir)) {
    return [];
  }
  let files;
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  const images = [];
  for (const f of files) {
    if (!f || f.startsWith(".") || f === ".DS_Store") continue;
    const full = resolve(dir, f);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    if (!IMAGE_EXT.has(extname(f).toLowerCase())) continue;
    images.push(f);
  }
  images.sort((a, b) => a.localeCompare(b));
  return images.map(
    (f) => `/api/supplier-media/blue-whale/images/${encodeURIComponent(code)}/${encodeURIComponent(f)}`,
  );
}

async function getProductColumns(supabase) {
  const { data, error } = await supabase.from("products").select("*").limit(1);
  if (error) {
    throw new Error(`Could not read products table: ${error.message}`);
  }
  if (!data?.length) {
    return new Set([
      "name",
      "slug",
      "category",
      "description",
      "base_price",
      "weight_kg",
      "stock_quantity",
      "image_urls",
      "available_colors",
      "available_sizes",
      "is_active",
      "sort_order",
      "supplier_name",
    ]);
  }
  return new Set(Object.keys(data[0]));
}

function trimRow(row, columns) {
  const out = {};
  for (const k of Object.keys(row)) {
    if (!columns.has(k)) continue;
    const v = row[k];
    if (v === undefined) continue;
    out[k] = v;
  }
  if (columns.has("stock_quantity") && out.stock_quantity === undefined) {
    out.stock_quantity = 0;
  }
  return out;
}

async function upsertProductsBatch(supabase, batch) {
  const deduped = [...new Map(batch.map((r) => [r.slug, r])).values()];
  if (!deduped.length) return;
  const names = deduped.map((r) => r.name);
  const slugs = [...new Set(deduped.map((r) => r.slug).filter(Boolean))];

  const { data: bySlug, error: slugErr } = slugs.length
    ? await supabase.from("products").select("id, name, slug").in("slug", slugs)
    : { data: [], error: null };
  if (slugErr) throw slugErr;

  const { data: byName, error: nameErr } = await supabase.from("products").select("id, name, slug").in("name", names);
  if (nameErr) throw nameErr;

  const idBySlug = new Map((bySlug ?? []).filter((r) => r.slug).map((r) => [r.slug, r.id]));
  const idByName = new Map((byName ?? []).map((r) => [r.name, r.id]));

  const toInsert = [];
  const toUpsertById = [];
  for (const row of deduped) {
    const id = idBySlug.get(row.slug) ?? idByName.get(row.name);
    if (id) toUpsertById.push({ id, ...row });
    else toInsert.push(row);
  }

  if (toInsert.length) {
    const { error: insErr } = await supabase.from("products").insert(toInsert);
    if (insErr) throw insErr;
  }
  if (toUpsertById.length) {
    const { error: upErr } = await supabase.from("products").upsert(toUpsertById, { onConflict: "id" });
    if (upErr) throw upErr;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = getBossWebRoot();
  const numbersPath = resolve(
    root,
    args.file ?? "data/supplier/blue-whale/2026-bluewhale-sku-reseller.numbers",
  );
  if (!existsSync(numbersPath)) {
    console.error(`Numbers file not found: ${numbersPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(numbersPath, { cellDates: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  if (!rows.length) {
    console.error("Empty Numbers workbook.");
    process.exit(1);
  }

  const header = (rows[0] ?? []).map((h) => String(h ?? ""));
  const headerNorm = header.map((h) => normalizeHeader(h));
  const idx = new Map(headerNorm.map((h, i) => [h, i]));
  const col = (name) => idx.get(normalizeHeader(name));

  const iBrand = col("Brand");
  const iSku = col("SKU");
  const iProductName = col("Product Name");
  const iStyleCode = col("Style Code");
  const iColour = col("Colour");
  const iSize = col("Size");
  const iCategory = col("Category");
  const iSubCategory = col("Sub Category");
  const iWebsite = col("Style Website Page");
  const iBlurb = col("Style Blurb");
  const iDetails = col("Style Details");
  const iReseller = col("Reseller");

  if (iStyleCode == null || iProductName == null) {
    console.error("Missing required columns: Style Code / Product Name.");
    console.error("Detected headers:", header);
    process.exit(1);
  }

  const grouped = new Map();
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const styleCode = String(row[iStyleCode] ?? "").trim();
    if (!styleCode) continue;

    const brand = normalizeBrand(iBrand != null ? row[iBrand] : "Blue Whale") || "Blue Whale";
    const productName = normalizeProductName(row[iProductName]);
    const sku = String(iSku != null ? row[iSku] : "").trim();
    const color = String(iColour != null ? row[iColour] : "").trim();
    const size = normalizeSizeToken(iSize != null ? row[iSize] : "");
    const category = String(iCategory != null ? row[iCategory] : "").trim();
    const subCategory = String(iSubCategory != null ? row[iSubCategory] : "").trim();
    const website = String(iWebsite != null ? row[iWebsite] : "").trim();
    const blurb = String(iBlurb != null ? row[iBlurb] : "").trim();
    const details = String(iDetails != null ? row[iDetails] : "").trim();
    const reseller = parsePrice(iReseller != null ? row[iReseller] : null);

    const g = grouped.get(styleCode) ?? {
      styleCode,
      brand,
      productNames: new Set(),
      categories: new Set(),
      subCategories: new Set(),
      website,
      blurbs: new Set(),
      details: new Set(),
      colors: new Set(),
      sizes: new Set(),
      prices: [],
      skus: new Set(),
    };

    if (productName) g.productNames.add(productName);
    if (category) g.categories.add(category);
    if (subCategory) g.subCategories.add(subCategory);
    if (!g.website && website) g.website = website;
    if (blurb) g.blurbs.add(blurb);
    if (details) g.details.add(details);
    if (color) g.colors.add(color);
    if (size) g.sizes.add(size);
    if (typeof reseller === "number" && reseller > 0) g.prices.push(reseller);
    if (sku) g.skus.add(sku);

    grouped.set(styleCode, g);
  }

  const styles = [...grouped.values()].slice(0, args.limit);
  const productRows = styles.map((g) => {
    const style = String(g.styleCode ?? "").trim().toUpperCase();
    const brand = normalizeBrand(g.brand || "Blue Whale") || "Blue Whale";
    const bestName =
      [...g.productNames].sort((a, b) => a.length - b.length)[0] ?? `${brand} ${style}`;
    const name = `${brand} ${bestName} (${style})`.replace(/\s+/g, " ").trim();
    const slug = `bw-${slugify(style)}`;
    const colors = [...g.colors].map((c) => String(c).trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const sizes = sortSizesUnique([...g.sizes]);
    const base_price = g.prices.length ? Math.min(...g.prices) : null;
    const cat = dbCategoryFromSheet([...g.categories][0] ?? "", [...g.subCategories][0] ?? "", bestName);

    const descParts = [];
    const blurb = [...g.blurbs].sort((a, b) => b.length - a.length)[0] || "";
    const details = [...g.details].sort((a, b) => b.length - a.length)[0] || "";
    if (blurb) descParts.push(blurb);
    if (details) descParts.push(details);
    if (g.website) descParts.push(`More info: ${g.website}`);
    const description = descParts.join("\n\n").trim();

    const image_urls = localImageUrlsForStyle(root, style);

    return {
      name,
      slug,
      category: cat,
      ...(description ? { description } : {}),
      ...(base_price != null ? { base_price } : {}),
      ...(image_urls.length ? { image_urls } : {}),
      ...(colors.length ? { available_colors: colors } : {}),
      ...(sizes.length ? { available_sizes: sizes } : {}),
      is_active: true,
      supplier_name: "Blue Whale",
    };
  });

  console.log(`Blue Whale Numbers: ${grouped.size} style codes → ${productRows.length} storefront products`);
  console.log("Sample:", JSON.stringify(productRows.slice(0, 2), null, 2));

  if (args.dryRun) {
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Warning: using anon key; upsert may fail under RLS.");
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const columns = await getProductColumns(supabase);
  const BATCH = 50;
  let ok = 0;
  for (let i = 0; i < productRows.length; i += BATCH) {
    const batch = productRows.slice(i, i + BATCH).map((r) => trimRow(r, columns));
    await upsertProductsBatch(supabase, batch);
    ok += batch.length;
    process.stdout.write(`\rUpserted ${ok}/${productRows.length}`);
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


/**
 * Import JB's Wear reseller XLSX into Supabase `products`.
 *
 * Aggregates rows by `Style Code` (one storefront product per style),
 * collecting colors + sizes + image URLs and using min reseller price.
 *
 * Usage (from repo root):
 *   node scripts/import-jbswear-xlsx.mjs --file="data/supplier/JB/2026 JBswear SKU - Reseller.xlsx" --dry-run --limit=5
 *   npm run import:jbswear
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

function parseArgs(argv) {
  const out = { file: null, dryRun: false, limit: Infinity, onlyStyle: null };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a.startsWith("--file=")) {
      out.file = a.slice("--file=".length).trim() || null;
    } else if (a.startsWith("--only-style=")) {
      out.onlyStyle = a.slice("--only-style=".length).trim() || null;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      out.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
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

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function localImageUrlsForJbStyle(root, styleCode) {
  const code = String(styleCode ?? "").trim();
  if (!code) {
    return [];
  }
  const dir = resolve(root, "data", "supplier", "JB", "images", code);
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
    const full = resolve(dir, f);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile()) {
      continue;
    }
    const ext = extname(f).toLowerCase();
    if (!IMAGE_EXT.has(ext)) {
      continue;
    }
    images.push(f);
  }
  images.sort((a, b) => a.localeCompare(b));
  return images.map(
    (f) => `/api/supplier-media/JB/images/${encodeURIComponent(code)}/${encodeURIComponent(f)}`,
  );
}

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

function stripLeadingJbWear(s) {
  return String(s ?? "")
    .trim()
    .replace(/^jb'?s\s+wear\s+/i, "")
    .trim();
}

/** Prefer a short listing title when "Product Name" mixes marketing copy and real titles. */
function pickJbListingTitle(productNames, styleCode, brand) {
  const arr = [...productNames].map((s) => stripLeadingJbWear(s)).filter(Boolean);
  if (!arr.length) {
    return `${brand} ${styleCode}`;
  }
  const MAX = 120;
  const byLen = [...arr].sort((a, b) => a.length - b.length);
  const short = byLen.find((s) => s.length >= 4 && s.length <= MAX);
  if (short) {
    return short;
  }
  const first = byLen[0];
  const line = first.split(/\r?\n/)[0].trim();
  if (line.length <= MAX) {
    return line;
  }
  const cut = line.slice(0, 100).replace(/\s+\S*$/, "").trim();
  return cut || `${brand} ${styleCode}`;
}

function dbCategoryFromJb(category, subCategory, name) {
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
  if (hay.includes("scrub")) return "Scrubs";
  if (hay.includes("boot")) return "Boots";
  if (hay.includes("glove")) return "Glove";
  if (hay.includes("glass") || hay.includes("goggle")) return "Safty Glasses";
  if (/\b(hat|cap|beanie|helmet|hard hat|balaclava|headwear|head wear)\b/.test(hay)) return "Head Wear";
  return "T-shirts";
}

/** Style codes starting with `6` → storefront Workwear (valid `products.category` labels only). */
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

async function getProductColumns(supabase) {
  const { data, error } = await supabase.from("products").select("*").limit(1);
  if (error) throw new Error(`Could not read products table: ${error.message}`);
  if (!data?.length) {
    return new Set([
      "name",
      "slug",
      "category",
      "description",
      "base_price",
      "image_urls",
      "available_colors",
      "available_sizes",
      "is_active",
      "supplier_name",
      "storefront_hidden",
      "audience",
      "stock_quantity",
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
    const { error } = await supabase.from("products").insert(toInsert);
    if (error) throw error;
  }
  if (toUpsertById.length) {
    const { error } = await supabase.from("products").upsert(toUpsertById, { onConflict: "id" });
    if (error) throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = getBossWebRoot();
  const fileArg = args.file ?? "data/supplier/JB/2026 JBswear SKU - Reseller.xlsx";
  const xlsxPath = resolve(root, fileArg);
  if (!existsSync(xlsxPath)) {
    console.error(`XLSX not found: ${xlsxPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(xlsxPath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    console.error("No sheets found in XLSX.");
    process.exit(1);
  }
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!rows.length) {
    console.error("Empty sheet.");
    process.exit(1);
  }

  const header = rows[0].map((h) => String(h ?? ""));
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
  const iImg = col("Colour Image URL");
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

    const brand = String(iBrand != null ? row[iBrand] : "JB's Wear").trim() || "JB's Wear";
    const productName = String(row[iProductName] ?? "").trim();
    const sku = String(iSku != null ? row[iSku] : "").trim();
    const color = String(iColour != null ? row[iColour] : "").trim();
    const size = normalizeSizeToken(iSize != null ? row[iSize] : "");
    const category = String(iCategory != null ? row[iCategory] : "").trim();
    const subCategory = String(iSubCategory != null ? row[iSubCategory] : "").trim();
    const website = String(iWebsite != null ? row[iWebsite] : "").trim();
    const blurb = String(iBlurb != null ? row[iBlurb] : "").trim();
    const details = String(iDetails != null ? row[iDetails] : "").trim();
    const imageUrl = String(iImg != null ? row[iImg] : "").trim();
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
      imageUrls: new Set(),
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
    if (imageUrl) g.imageUrls.add(imageUrl);
    if (typeof reseller === "number" && reseller > 0) g.prices.push(reseller);
    if (sku) g.skus.add(sku);

    grouped.set(styleCode, g);
  }

  const only = args.onlyStyle ? String(args.onlyStyle).trim().toUpperCase() : null;
  const styles = [...grouped.values()]
    .filter((g) => !only || String(g.styleCode ?? "").trim().toUpperCase() === only)
    .slice(0, args.limit);
  const productRows = styles.map((g) => {
    const brand = String(g.brand || "JB's Wear").replace(/\s+/g, " ").trim();
    const bestName = stripLeadingJbWear(pickJbListingTitle(g.productNames, g.styleCode, brand));
    const name = `JB's Wear ${bestName} (${g.styleCode})`;
    const slug = `jb-${slugify(g.styleCode)}`;
    const colors = [...g.colors].sort((a, b) => a.localeCompare(b));
    const sizes = sortSizesUnique([...g.sizes]);
    const fromXlsx = [...g.imageUrls].filter(Boolean);
    const fromLocal = localImageUrlsForJbStyle(root, g.styleCode);
    const image_urls = [...new Set([...fromLocal, ...fromXlsx])];
    const base_price = g.prices.length ? Math.min(...g.prices) : null;
    const styleStartsSix = /^6/i.test(String(g.styleCode ?? "").trim());
    const cat = styleStartsSix
      ? dbCategoryJbSixWorkwear(
          [...g.categories][0] ?? "",
          [...g.subCategories][0] ?? "",
          bestName,
        )
      : dbCategoryFromJb(
          [...g.categories][0] ?? "",
          [...g.subCategories][0] ?? "",
          bestName,
        );

    const descParts = [];
    const longestRaw =
      [...g.productNames].sort((a, b) => String(b).length - String(a).length)[0] ?? "";
    const longestNorm = stripLeadingJbWear(longestRaw);
    if (
      longestRaw.trim() &&
      longestNorm !== bestName &&
      longestRaw.trim().length - bestName.length > 15
    ) {
      descParts.push(longestRaw.trim());
    }
    const blurb = [...g.blurbs].sort((a, b) => b.length - a.length)[0] || "";
    const details = [...g.details].sort((a, b) => b.length - a.length)[0] || "";
    if (blurb) descParts.push(blurb);
    if (details) descParts.push(details);
    if (g.website) descParts.push(`More info: ${g.website}`);
    const description = descParts.join("\n\n").trim();

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
      supplier_name: "JB's Wear",
    };
  });

  console.log(`JB's Wear XLSX: ${grouped.size} style codes → ${productRows.length} storefront products`);
  console.log("Sample:", JSON.stringify(productRows.slice(0, 2), null, 2));

  if (args.dryRun) return;

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


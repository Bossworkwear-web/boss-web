/**
 * Import Bisley catalog CSV into Supabase `products`.
 *
 * Aggregates variants (size + color) into one storefront product per `Product Code`.
 *
 * Usage (from repo root):
 *   node scripts/import-bisley-csv.mjs --file=data/supplier/bisley/myPIP_Product_Listing.20260420.csv --dry-run --limit=5
 *   node scripts/import-bisley-csv.mjs --file=data/supplier/bisley/myPIP_Product_Listing.20260420.csv
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnvLocal();

function parseArgs(argv) {
  const out = {
    file: null,
    dryRun: false,
    limit: Infinity,
  };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a.startsWith("--file=")) {
      out.file = a.slice("--file=".length).trim() || null;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      out.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
    }
  }
  return out;
}

/**
 * RFC4180-ish CSV parser supporting:
 * - commas
 * - newlines inside quoted fields
 * - escaped quotes via ""
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }
    if (c === "\r") {
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeSizeToken(raw) {
  const s = String(raw ?? "").trim();
  if (!s) {
    return "";
  }
  const up = s.toUpperCase();
  if (/^(?:ONE\s*SIZE|OS|O\/S|FREE)$/i.test(s)) {
    return "One Size";
  }
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
    if (ra !== rb) {
      return ra - rb;
    }
    return a.localeCompare(b);
  });
  return uniq;
}

function parseCsvPriceCell(raw) {
  const s = String(raw ?? "").trim();
  if (!s) {
    return null;
  }
  const n = Number.parseFloat(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function inferDbCategoryFromName(productName) {
  const n = String(productName ?? "").toLowerCase();
  if (!n.trim()) {
    return "Work Shirts";
  }
  if (n.includes("t-shirt") || /\btee\b/.test(n) || /\bt\s*shirt\b/.test(n)) {
    return "T-shirts";
  }
  if (n.includes("polo")) {
    return "Polos";
  }
  if (n.includes("scrub")) {
    return "Scrubs";
  }
  if (n.includes("pant") || n.includes("trouser") || n.includes("short") || n.includes("overall")) {
    return "Pants";
  }
  if (n.includes("jacket") || n.includes("hoodie") || n.includes("fleece") || n.includes("softshell")) {
    return "Jackets";
  }
  if (n.includes("boot")) {
    return "Boots";
  }
  if (n.includes("glove")) {
    return "Glove";
  }
  if (n.includes("glass") || n.includes("goggle")) {
    return "Safty Glasses";
  }
  if (/\b(hat|cap|beanie|helmet|hard hat|balaclava|headwear|head wear)\b/.test(n)) {
    return "Head Wear";
  }
  if (n.includes("shirt")) {
    return "Work Shirts";
  }
  return "Work Shirts";
}

function audienceFromBisleyCategory(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) {
    return null;
  }
  if (s === "men's" || s === "mens" || s === "men") {
    return "mens";
  }
  if (s === "women's" || s === "womens" || s === "women" || s === "ladies" || s === "lady") {
    return "womens";
  }
  if (s === "kids" || s === "kid's" || s === "child" || s === "children") {
    return "kids";
  }
  if (s === "unisex") {
    return "unisex";
  }
  return null;
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
    if (!columns.has(k)) {
      continue;
    }
    const v = row[k];
    if (v === undefined) {
      continue;
    }
    out[k] = v;
  }
  if (columns.has("stock_quantity") && out.stock_quantity === undefined) {
    out.stock_quantity = 0;
  }
  return out;
}

async function upsertProductsBatch(supabase, batch) {
  const deduped = [...new Map(batch.map((r) => [r.slug, r])).values()];
  if (!deduped.length) {
    return;
  }
  const names = deduped.map((r) => r.name);
  const slugs = [...new Set(deduped.map((r) => r.slug).filter(Boolean))];

  const { data: bySlug, error: slugErr } = slugs.length
    ? await supabase.from("products").select("id, name, slug").in("slug", slugs)
    : { data: [], error: null };
  if (slugErr) {
    throw slugErr;
  }
  const { data: byName, error: nameErr } = await supabase.from("products").select("id, name, slug").in("name", names);
  if (nameErr) {
    throw nameErr;
  }

  const idBySlug = new Map((bySlug ?? []).filter((r) => r.slug).map((r) => [r.slug, r.id]));
  const idByName = new Map((byName ?? []).map((r) => [r.name, r.id]));

  const toInsert = [];
  const toUpsertById = [];
  for (const row of deduped) {
    const id = idBySlug.get(row.slug) ?? idByName.get(row.name);
    if (id) {
      toUpsertById.push({ id, ...row });
    } else {
      toInsert.push(row);
    }
  }

  if (toInsert.length) {
    const { error: insErr } = await supabase.from("products").insert(toInsert);
    if (insErr) {
      throw insErr;
    }
  }
  if (toUpsertById.length) {
    const { error: upErr } = await supabase.from("products").upsert(toUpsertById, { onConflict: "id" });
    if (upErr) {
      throw upErr;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = getBossWebRoot();
  const fileArg = args.file ?? "data/supplier/bisley/myPIP_Product_Listing.20260420.csv";
  const csvPath = resolve(root, fileArg);
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const text = readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  if (!rows.length) {
    console.error("Empty CSV.");
    process.exit(1);
  }

  const header = rows[0].map((h) => String(h ?? "").trim());
  const idx = Object.fromEntries(header.map((h, i) => [h.toLowerCase(), i]));
  const need = (name) => idx[name.toLowerCase()];
  const idxBrand = need("brand");
  const idxProductCode = need("product code");
  const idxEan = need("ean");
  const idxCategory = need("category");
  const idxProductName = need("product name");
  const idxColourName = need("colour name");
  const idxSize = need("size");
  const idxImageUrl = need("image url");
  const idxPrice = need("price");
  const idxDesc = need("product description");
  const idxSizesText = need("sizes text");
  const idxFabric = need("fabric");

  if (idxProductCode == null || idxProductName == null) {
    console.error("CSV header missing required columns (Product Code / Product Name).");
    process.exit(1);
  }

  const grouped = new Map();
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    if (!r || r.length === 0) {
      continue;
    }
    const productCode = String(r[idxProductCode] ?? "").trim();
    if (!productCode) {
      continue;
    }
    const brand = String(r[idxBrand] ?? "Bisley").trim() || "Bisley";
    const productName = String(r[idxProductName] ?? "").trim();
    const color = String(r[idxColourName] ?? "").trim();
    const size = normalizeSizeToken(r[idxSize] ?? "");
    const imageUrl = String(r[idxImageUrl] ?? "").trim();
    const price = parseCsvPriceCell(r[idxPrice]);
    const desc = String(r[idxDesc] ?? "").trim();
    const sizesText = String(r[idxSizesText] ?? "").trim();
    const fabric = String(r[idxFabric] ?? "").trim();
    const ean = String(r[idxEan] ?? "").trim();
    const genderCat = String(r[idxCategory] ?? "").trim();
    const aud = audienceFromBisleyCategory(genderCat);

    const g = grouped.get(productCode) ?? {
      productCode,
      brand,
      productName,
      genderCategory: genderCat,
      audience: aud,
      eans: new Set(),
      colors: new Set(),
      sizes: new Set(),
      imageUrls: new Set(),
      prices: [],
      descs: new Set(),
      sizesText: new Set(),
      fabrics: new Set(),
    };

    if (ean) g.eans.add(ean);
    if (color) g.colors.add(color);
    if (size) g.sizes.add(size);
    if (imageUrl) g.imageUrls.add(imageUrl);
    if (typeof price === "number" && Number.isFinite(price) && price > 0) g.prices.push(price);
    if (desc) g.descs.add(desc);
    if (sizesText) g.sizesText.add(sizesText);
    if (fabric) g.fabrics.add(fabric);

    if (!g.audience && aud) {
      g.audience = aud;
    }

    grouped.set(productCode, g);
  }

  const limited = [...grouped.values()].slice(0, args.limit);
  const productRows = limited.map((g) => {
    const displayBrand = String(g.brand || "Bisley").replace(/\s+/g, " ").trim();
    const title = g.productName ? `${g.productName} (${g.productCode})` : `${displayBrand} ${g.productCode}`;
    const slug = `bis-${String(g.productCode).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const colors = [...g.colors].sort((a, b) => a.localeCompare(b));
    const sizes = sortSizesUnique([...g.sizes]);
    const image_urls = [...g.imageUrls].filter(Boolean);
    const base_price = g.prices.length ? Math.min(...g.prices) : null;
    const category = inferDbCategoryFromName(g.productName || title);

    const descParts = [];
    if (g.descs.size > 0) {
      // Prefer the longest description when multiple variants include the same copy.
      const longest = [...g.descs].sort((a, b) => b.length - a.length)[0];
      if (longest) descParts.push(longest);
    }
    const fabric = g.fabrics.size > 0 ? [...g.fabrics].sort((a, b) => a.length - b.length)[0] : "";
    const sizesText = g.sizesText.size > 0 ? [...g.sizesText].sort((a, b) => a.length - b.length)[0] : "";
    if (fabric) descParts.push(`Fabric: ${fabric}`);
    if (sizesText) descParts.push(`Sizes: ${sizesText.replace(/\s+/g, " ").trim()}`);
    const description = descParts.join("\n\n").trim();

    return {
      name: title,
      slug,
      category,
      ...(description ? { description } : {}),
      ...(base_price != null ? { base_price } : {}),
      ...(image_urls.length ? { image_urls } : {}),
      ...(colors.length ? { available_colors: colors } : {}),
      ...(sizes.length ? { available_sizes: sizes } : {}),
      is_active: true,
      supplier_name: "Bisley",
      ...(g.audience ? { audience: g.audience } : {}),
    };
  });

  console.log(`Bisley CSV: ${grouped.size} product codes → ${productRows.length} storefront products`);
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
    try {
      await upsertProductsBatch(supabase, batch);
    } catch (e) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} failed:`, e instanceof Error ? e.message : e);
      process.exit(1);
    }
    ok += batch.length;
    process.stdout.write(`\rUpserted ${ok}/${productRows.length}`);
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


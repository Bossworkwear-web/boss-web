/**
 * Import DNC Workwear product-details CSV into Supabase `products`.
 *
 * Parent rows (no colour/size) define each style; variant rows supply SKUs, colours, and sizes.
 *
 * Usage (from repo root):
 *   node scripts/import-dnc-csv.mjs --dry-run --limit=10
 *   node scripts/import-dnc-csv.mjs --file=data/supplier/dnc/product-details.csv
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildDncColorGallery, dncExtractColorCodeFromVariant } from "./lib/dnc-color-images.mjs";
import { isDncGloveStyleCode } from "./lib/dnc-glove-routing.mjs";
import { buildDncProductDescription } from "./lib/dnc-product-description.mjs";
import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = "data/supplier/dnc/product-details.csv";
const SUPPLIER_NAME = "DNC Workwear";
const DNC_HIRES_BASE = "https://www.dncworkwear.com.au/images/hires/";

loadEnvLocal();

function parseArgs(argv) {
  const out = {
    file: null,
    dryRun: false,
    limit: Infinity,
    descriptionsOnly: false,
  };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a === "--descriptions-only") {
      out.descriptionsOnly = true;
    } else if (a.startsWith("--file=")) {
      out.file = a.slice("--file=".length).trim() || null;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      out.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
    }
  }
  return out;
}

/** RFC4180-ish CSV parser (commas, quoted fields, escaped quotes). */
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
  return Number.isFinite(n) && n > 0 ? n : null;
}

function dncImageUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) {
    return null;
  }
  if (/^https?:\/\//i.test(s)) {
    return s;
  }
  return `${DNC_HIRES_BASE}${encodeURIComponent(s)}`;
}

function collectImageUrls(...sources) {
  const out = [];
  const seen = new Set();
  for (const src of sources) {
    const url = dncImageUrl(src);
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    out.push(url);
  }
  return out;
}

function audienceFromProductName(productName) {
  const n = String(productName ?? "").toLowerCase();
  if (/\b(ladies|ladies'|women|women's|womens|female)\b/.test(n)) {
    return "womens";
  }
  if (/\b(kids|kid's|children|child|youth|junior)\b/.test(n)) {
    return "kids";
  }
  if (/\b(mens|men's|men)\b/.test(n)) {
    return "mens";
  }
  if (/\bunisex\b/.test(n)) {
    return "unisex";
  }
  return null;
}

function inferDncDbCategory(productName, styleCode) {
  if (isDncGloveStyleCode(styleCode)) {
    return "Glove";
  }
  const n = String(productName ?? "").toLowerCase();
  if (!n.trim()) {
    return "Work Shirts";
  }
  if (n.includes("glove")) {
    return "Glove";
  }
  if (/\b(apron|bib\s*apron)\b/.test(n)) {
    return "Apron";
  }
  if (/\bchef\b/.test(n)) {
    return "Chef";
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
  if (n.includes("coverall") || n.includes("overall")) {
    return "Coverall";
  }
  if (n.includes("pant") || n.includes("trouser") || n.includes("short") || n.includes("jogger")) {
    return "Pants";
  }
  if (
    n.includes("jacket") ||
    n.includes("hoodie") ||
    n.includes("fleece") ||
    n.includes("softshell") ||
    n.includes("jumper") ||
    n.includes("sweater")
  ) {
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
  if (/\b(hi[\s-]*vis|high[\s-]*vis|hivis)\b/.test(n) && /\bvests?\b/.test(n)) {
    return "Hi-vis Vest";
  }
  if (/\b(hat|cap|beanie|helmet|hard hat|balaclava|headwear|head wear)\b/.test(n)) {
    return "Head Wear";
  }
  if (n.includes("sock")) {
    return "Miscellaneous";
  }
  if (n.includes("shirt")) {
    return "Work Shirts";
  }
  if (/\bvests?\b/.test(n)) {
    return "Miscellaneous";
  }
  return "Work Shirts";
}

function dncSlug(styleCode) {
  return `dnc-${String(styleCode)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
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
      "audience",
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

function isDncNonProductStyleRow(styleCode, productName, colorField) {
  const name = String(productName ?? "").toLowerCase();
  if (/\bsurcharge\b/.test(name) || /\bcredit card payment\b/.test(name)) {
    return true;
  }
  if (String(colorField ?? "").toLowerCase() === "payment") {
    return true;
  }
  if (styleCode === "156540") {
    return true;
  }
  return false;
}

export function buildGroupedProducts(rows) {
  const idx = (header, name) => header.findIndex((h) => String(h).trim().toLowerCase() === name.toLowerCase());

  const header = rows[0].map((h) => String(h ?? "").trim());
  const iCode = idx(header, "ProductCode");
  const iDesc = idx(header, "Description");
  const iDesc2 = idx(header, "Description2");
  const iDesc3 = idx(header, "Description3");
  const iPrice = idx(header, "List Price before discount and GST");
  const iImage = idx(header, "Image");
  const iUrl = idx(header, "URL");
  const iPic1 = idx(header, "Picture 1");
  const iPic2 = idx(header, "Picture 2");
  const iPic3 = idx(header, "Picture 3");
  const iCondition = idx(header, "Condition");

  if (iCode < 0 || iDesc < 0) {
    throw new Error("CSV header missing ProductCode or Description.");
  }

  /** @type {Array<{code:string,color:string,size:string,description:string,price:number|null,image:string,pic1:string,pic2:string,pic3:string,url:string}>} */
  const styleRows = [];
  /** @type {typeof styleRows} */
  const variantRows = [];

  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    if (!r?.length) {
      continue;
    }
    const code = String(r[iCode] ?? "").trim();
    if (!code) {
      continue;
    }
    const color = iDesc2 >= 0 ? String(r[iDesc2] ?? "").trim() : "";
    const size = iDesc3 >= 0 ? normalizeSizeToken(r[iDesc3] ?? "") : "";
    const description = String(r[iDesc] ?? "").trim();
    const price = parseCsvPriceCell(iPrice >= 0 ? r[iPrice] : "");
    const image = iImage >= 0 ? String(r[iImage] ?? "").trim() : "";
    const url = iUrl >= 0 ? String(r[iUrl] ?? "").trim() : "";
    const pic1 = iPic1 >= 0 ? String(r[iPic1] ?? "").trim() : "";
    const pic2 = iPic2 >= 0 ? String(r[iPic2] ?? "").trim() : "";
    const pic3 = iPic3 >= 0 ? String(r[iPic3] ?? "").trim() : "";
    const condition = iCondition >= 0 ? String(r[iCondition] ?? "").trim() : "";

    const parsed = {
      code,
      color,
      size,
      description,
      price,
      image,
      pic1,
      pic2,
      pic3,
      url,
      condition,
    };

    if (size) {
      variantRows.push(parsed);
    } else {
      styleRows.push(parsed);
    }
  }

  const styleCodes = styleRows
    .map((s) => s.code)
    .filter((code) => {
      const row = styleRows.find((s) => s.code === code);
      return row && !isDncNonProductStyleRow(code, row.description, row.color);
    })
    .sort((a, b) => b.length - a.length);

  function resolveStyleParent(variantCode) {
    for (const parent of styleCodes) {
      if (variantCode.startsWith(parent) && variantCode.length > parent.length) {
        return parent;
      }
    }
    return null;
  }

  const styleCodesWithVariants = new Set();
  for (const v of variantRows) {
    const parent = resolveStyleParent(v.code);
    if (parent) {
      styleCodesWithVariants.add(parent);
    }
  }

  const grouped = new Map();

  for (const s of styleRows) {
    if (isDncNonProductStyleRow(s.code, s.description, s.color)) {
      continue;
    }
    if (!styleCodesWithVariants.has(s.code)) {
      continue;
    }
    grouped.set(s.code, {
      styleCode: s.code,
      productName: s.description || `DNC ${s.code}`,
      productUrl: s.url,
      colors: new Set(),
      sizes: new Set(),
      colorToUrls: new Map(),
      colorCodes: new Map(),
      imageUrls: new Set(collectImageUrls(s.image, s.pic1, s.pic2, s.pic3)),
      prices: typeof s.price === "number" ? [s.price] : [],
      hasDiscontinuedVariants: /^discontinued$/i.test(s.condition),
    });
  }

  let orphanVariants = 0;
  for (const v of variantRows) {
    const parentCode = resolveStyleParent(v.code);
    if (!parentCode) {
      orphanVariants += 1;
      continue;
    }
    let g = grouped.get(parentCode);
    if (!g) {
      const parentRow = styleRows.find((s) => s.code === parentCode);
      g = {
        styleCode: parentCode,
        productName: parentRow?.description || v.description || `DNC ${parentCode}`,
        productUrl: parentRow?.url || v.url,
        colors: new Set(),
        sizes: new Set(),
        colorToUrls: new Map(),
        colorCodes: new Map(),
        imageUrls: new Set(
          parentRow ? collectImageUrls(parentRow.image, parentRow.pic1, parentRow.pic2, parentRow.pic3) : [],
        ),
        prices: typeof parentRow?.price === "number" ? [parentRow.price] : [],
        hasDiscontinuedVariants: /^discontinued$/i.test(parentRow?.condition ?? ""),
      };
      grouped.set(parentCode, g);
    }
    if (/^discontinued$/i.test(v.condition)) {
      g.hasDiscontinuedVariants = true;
    }
    if (v.color) {
      g.colors.add(v.color);
      const colorCode = dncExtractColorCodeFromVariant(parentCode, v.code);
      if (colorCode && !g.colorCodes.has(v.color)) {
        g.colorCodes.set(v.color, colorCode);
      }
      if (!g.colorToUrls.has(v.color)) {
        g.colorToUrls.set(v.color, new Set());
      }
      for (const url of collectImageUrls(v.image, v.pic1, v.pic2, v.pic3)) {
        g.colorToUrls.get(v.color).add(url);
        g.imageUrls.add(url);
      }
    } else if (v.size) {
      for (const url of collectImageUrls(v.image, v.pic1, v.pic2, v.pic3)) {
        g.imageUrls.add(url);
      }
    }
    if (v.size) {
      g.sizes.add(v.size);
    }
    if (typeof v.price === "number") {
      g.prices.push(v.price);
    }
  }

  for (const s of styleRows) {
    if (isDncNonProductStyleRow(s.code, s.description, s.color)) {
      continue;
    }
    if (styleCodesWithVariants.has(s.code) || grouped.has(s.code)) {
      continue;
    }
    grouped.set(s.code, {
      styleCode: s.code,
      productName: s.description || `DNC ${s.code}`,
      productUrl: s.url,
      colors: new Set(s.color ? [s.color] : []),
      sizes: new Set(["One Size"]),
      colorToUrls: new Map(),
      colorCodes: new Map(),
      imageUrls: new Set(collectImageUrls(s.image, s.pic1, s.pic2, s.pic3)),
      prices: typeof s.price === "number" ? [s.price] : [],
      hasDiscontinuedVariants: /^discontinued$/i.test(s.condition),
    });
  }

  const productRows = [...grouped.values()].map((g) => {
    const title = `${g.productName} (${g.styleCode})`;
    const slug = dncSlug(g.styleCode);
    const { colors, image_urls } = buildDncColorGallery(g);
    const sizes = sortSizesUnique([...g.sizes]);
    const base_price = g.prices.length ? Math.min(...g.prices) : null;
    const category = inferDncDbCategory(g.productName, g.styleCode);
    const audience = audienceFromProductName(g.productName);
    const description = buildDncProductDescription({
      productName: g.productName,
      styleCode: g.styleCode,
      category,
      colors,
      sizes,
      hasDiscontinuedVariants: Boolean(g.hasDiscontinuedVariants),
    });

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
      supplier_name: SUPPLIER_NAME,
      ...(audience ? { audience } : {}),
    };
  });

  return {
    productRows,
    styleRowCount: styleRows.length,
    variantCount: variantRows.length,
    orphanVariants,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = getBossWebRoot();
  const csvPath = resolve(root, args.file ?? DEFAULT_CSV);
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

  const { productRows, styleRowCount, variantCount, orphanVariants } = buildGroupedProducts(rows);
  const limited = productRows.slice(0, args.limit);

  console.log(
    `DNC CSV: ${styleRowCount} style row(s), ${variantCount} variant row(s) → ${productRows.length} storefront product(s)` +
      (orphanVariants ? ` (${orphanVariants} variant(s) without parent code skipped)` : ""),
  );
  if (args.limit < Infinity) {
    console.log(`Limit ${args.limit} → importing ${limited.length} product(s)`);
  }
  console.log("Sample:", JSON.stringify(limited.slice(0, 2), null, 2));

  if (args.dryRun) {
    console.log("Dry run — no database changes.");
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

  if (args.descriptionsOnly) {
    let ok = 0;
    for (const row of limited) {
      const description = row.description;
      if (!description || !row.slug) {
        continue;
      }
      const { error } = await supabase
        .from("products")
        .update({ description })
        .eq("slug", row.slug)
        .eq("supplier_name", SUPPLIER_NAME);
      if (error) {
        console.error(`Update failed for ${row.slug}:`, error.message);
        process.exit(1);
      }
      ok += 1;
      if (ok % 25 === 0 || ok === limited.length) {
        process.stdout.write(`\rUpdated descriptions ${ok}/${limited.length}`);
      }
    }
    console.log("\nDone (descriptions only).");
    return;
  }

  const BATCH = 50;
  let ok = 0;
  for (let i = 0; i < limited.length; i += BATCH) {
    const batch = limited.slice(i, i + BATCH).map((r) => trimRow(r, columns));
    try {
      await upsertProductsBatch(supabase, batch);
    } catch (e) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} failed:`, e instanceof Error ? e.message : e);
      process.exit(1);
    }
    ok += batch.length;
    process.stdout.write(`\rUpserted ${ok}/${limited.length}`);
  }
  console.log("\nDone.");
}

const isCliEntry = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isCliEntry) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

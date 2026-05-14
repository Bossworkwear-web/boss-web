/**
 * Replace all Blue Whale storefront rows in Supabase `products` with data from the supplier CSV
 * and flat `data/supplier/blue-whale/images/*.jpg` (same-origin URLs via `/api/supplier-media/blue-whale/...`).
 *
 * Deletes every row with `supplier_name = 'Blue Whale'`, then inserts one product per CSV line.
 *
 * Source:
 *   data/supplier/blue-whale/All products Information 2025 BOSS WORKWEAR.csv
 *
 * Usage:
 *   node scripts/import-blue-whale-csv.mjs --dry-run
 *   node scripts/import-blue-whale-csv.mjs
 *   node scripts/import-blue-whale-csv.mjs --file=/path/to.csv
 *
 * After import, upload images to Storage (if not already there):
 *   npm run upload:supplier-images -- --supplier=blue-whale
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnvLocal();

const SUPPLIER_FOLDER = "blue-whale";
const DEFAULT_CSV = `data/supplier/${SUPPLIER_FOLDER}/All products Information 2025 BOSS WORKWEAR.csv`;
const STORAGE_MEDIA_PREFIX = `/api/supplier-media/${SUPPLIER_FOLDER}/images`;

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function parseArgs(argv) {
  const out = { dryRun: false, limit: Infinity, file: null, skipDelete: false };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a === "--skip-delete") {
      out.skipDelete = true;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      out.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
    } else if (a.startsWith("--file=")) {
      out.file = a.slice("--file=".length).trim() || null;
    }
  }
  return out;
}

function canonHeader(s) {
  return String(s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

/** CSV can repeat the same style code for different listings (e.g. two T04 rows). */
function uniqueSlug(styleCode, productName, usedSlugs) {
  const code = String(styleCode ?? "").trim().toUpperCase();
  let base = `bw-${slugify(code)}`;
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }
  const nameBit = slugify(String(productName ?? "").slice(0, 72)) || "variant";
  let candidate = `${base}-${nameBit}`.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
  let n = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${nameBit}-${n}`.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
    n += 1;
  }
  usedSlugs.add(candidate);
  return candidate;
}

function parsePrice(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
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

/**
 * Map supplier CSV `category` to `products.category` labels used by the storefront.
 */
function dbCategoryFromCsv(category, productName) {
  const c = String(category ?? "").trim().toLowerCase();
  const hay = `${category ?? ""} ${productName ?? ""}`.toLowerCase();

  if (c.includes("polo") || hay.includes("polo shirt")) return "Polos";
  if (c.includes("t shirt") || c === "t shirts" || /\bt[- ]?shirt\b/.test(hay)) return "T-shirts";
  if (c.includes("singlet")) return "T-shirts";
  if (c.includes("shirt") && !c.includes("t shirt")) return "Shirts";
  if (c.includes("hoodie") || c.includes("hoodies") || (c.includes("fleece") && hay.includes("jumper"))) {
    if (/\bvest\b/.test(hay) && !isHiVisName(hay)) return "Jumper";
    return "Jumper";
  }
  if (c.includes("jacket")) return "Jackets";
  if (c.includes("jumper") || c.includes("knit")) return "Jumper";
  if (c.includes("pant") || c.includes("trouser") || c.includes("short")) return "Pants";
  if (c.includes("scrub")) return "Scrubs";
  if (c.includes("apron")) return "Apron";
  if (c.includes("boot")) return "Boots";
  if (c.includes("glove")) return "Glove";
  if (c.includes("vest")) {
    if (isHiVisName(hay)) return "Hi-vis vest";
    return "Miscellaneous";
  }
  if (c.includes("vests")) {
    return isHiVisName(hay) ? "Hi-vis vest" : "Miscellaneous";
  }
  return "T-shirts";
}

function isHiVisName(hay) {
  return (
    /\b(hi[\s-]*vis|high[\s-]*vis|hivis|fluoro|reflective)\b/.test(hay) ||
    /\b(safety|rail)\s+vest\b/.test(hay)
  );
}

function parseBoolActive(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return true;
  if (s === "inactive" || s === "0" || s === "false" || s === "no") return false;
  return true;
}

function splitCommaList(raw) {
  if (raw == null || raw === "") return [];
  return String(raw)
    .split(",")
    .map((x) => x.replace(/\u00A0/g, " ").trim())
    .filter(Boolean);
}

function buildImageLookup(imagesDir) {
  /** @type {Map<string, string>} */
  const exact = new Map();
  if (!existsSync(imagesDir)) {
    return exact;
  }
  for (const f of readdirSync(imagesDir)) {
    if (!f || f.startsWith(".") || f === ".DS_Store") continue;
    const full = join(imagesDir, f);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    if (!IMAGE_EXT.has(extname(f).toLowerCase())) continue;
    const key = f.replace(/\u00A0/g, " ").trim().toLowerCase();
    if (!exact.has(key)) exact.set(key, f);
    /** CSV often omits the space before `.jpg` that exists on disk (`foo .jpg`). */
    const tightDot = key.replace(/\s+\./g, ".");
    if (tightDot !== key && !exact.has(tightDot)) exact.set(tightDot, f);
  }
  return exact;
}

function resolveImageFilename(requested, lookup) {
  const t = String(requested ?? "").replace(/\u00A0/g, " ").trim();
  if (!t) return null;
  const key = t.toLowerCase();
  if (lookup.has(key)) return lookup.get(key);
  const collapsed = key.replace(/\s+/g, " ");
  if (lookup.has(collapsed)) return lookup.get(collapsed);
  for (const [k, v] of lookup) {
    if (k.replace(/\s+/g, " ") === collapsed) return v;
  }
  return null;
}

function imageUrlsForRow(imageListRaw, lookup) {
  const tokens = splitCommaList(imageListRaw);
  const urls = [];
  for (const tok of tokens) {
    const file = resolveImageFilename(tok, lookup);
    if (!file) {
      continue;
    }
    urls.push(`${STORAGE_MEDIA_PREFIX}/${encodeURIComponent(file)}`);
  }
  return urls;
}

function rowToCanon(obj) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[canonHeader(k)] = v == null ? "" : String(v);
  }
  return out;
}

function buildDescription(r) {
  const parts = [];
  const desc = r.description?.trim();
  if (desc) parts.push(desc);
  const emb = r["embroidery / print suitab"]?.trim();
  if (emb) parts.push(`Decoration: ${emb}`);
  const feat = r.product_features?.trim();
  if (feat) parts.push(feat);
  const mat = r.product_materials?.trim();
  if (mat) parts.push(`Materials: ${mat}`);
  const chart = r.product_item_size?.trim();
  if (chart) parts.push(`Sizing: ${chart}`);
  const url = r.product_url?.trim();
  if (url) parts.push(`More info: ${url}`);
  const group = r.product_code_group?.trim();
  if (group) parts.push(`Related styles: ${group}`);
  const tags = r.product_tags?.trim();
  if (tags) parts.push(`Tags: ${tags}`);
  return parts.join("\n\n").trim().slice(0, 32000);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = getBossWebRoot();
  const csvPath = resolve(root, args.file ?? DEFAULT_CSV);
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const imagesDir = resolve(root, "data", "supplier", SUPPLIER_FOLDER, "images");
  const lookup = buildImageLookup(imagesDir);

  const wb = XLSX.readFile(csvPath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  if (!rawRows.length) {
    console.error("Empty CSV.");
    process.exit(1);
  }

  /** @type {any[]} */
  const productRows = [];
  const usedSlugs = new Set();
  let skipped = 0;
  let missingImg = 0;

  for (let i = 0; i < rawRows.length; i += 1) {
    const r = rowToCanon(rawRows[i]);
    const code = r["supplier_product_code"]?.trim() ?? "";
    if (!code || /^supplier_product/i.test(code)) {
      skipped += 1;
      continue;
    }
    if (/^discontinued/i.test(r.product_name ?? "")) {
      skipped += 1;
      continue;
    }

    const productName = (r.product_name ?? "").replace(/\s+/g, " ").trim();
    if (!productName) {
      skipped += 1;
      continue;
    }

    const style = code.toUpperCase();
    const name = `Blue Whale ${productName} (${style})`.replace(/\s+/g, " ").trim();
    const slug = uniqueSlug(style, productName, usedSlugs);
    const category = dbCategoryFromCsv(r.category, productName);
    const description = buildDescription(r) || undefined;
    const base_price = parsePrice(r.base_price);
    const is_active = parseBoolActive(r.is_active);

    const colors = splitCommaList(r.available_colours).sort((a, b) => a.localeCompare(b));
    const sizesRaw = splitCommaList(r.available_sizes).map(normalizeSizeToken).filter(Boolean);
    const sizes = sortSizesUnique(sizesRaw);

    const image_urls = imageUrlsForRow(r.image_urls, lookup);
    if (r.image_urls?.trim() && image_urls.length === 0) {
      missingImg += 1;
    }

    productRows.push({
      name,
      slug,
      category,
      ...(description ? { description } : {}),
      ...(base_price != null ? { base_price } : {}),
      ...(image_urls.length ? { image_urls } : {}),
      ...(colors.length ? { available_colors: colors } : {}),
      ...(sizes.length ? { available_sizes: sizes } : {}),
      is_active,
      supplier_name: "Blue Whale",
      stock_quantity: 0,
    });
  }

  const limited = productRows.slice(0, args.limit);

  console.log(
    `Blue Whale CSV: ${rawRows.length} row(s) → ${productRows.length} product(s)` +
      (args.limit < Infinity ? ` (limit ${args.limit} → ${limited.length})` : ""),
  );
  console.log(`Skipped blank/header rows: ${skipped}`);
  console.log(`Products with image filenames in CSV but no local file match: ${missingImg}`);
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
    console.warn("Warning: using anon key; delete/insert may fail under RLS.");
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (!args.skipDelete) {
    const { error: delErr } = await supabase.from("products").delete().eq("supplier_name", "Blue Whale");
    if (delErr) {
      console.error("Delete Blue Whale products failed:", delErr.message);
      console.error(delErr);
      process.exit(1);
    }
    console.log("Deleted existing rows where supplier_name = 'Blue Whale'.");
  }

  const columns = await getProductColumns(supabase);
  const BATCH = 40;
  let ok = 0;
  for (let i = 0; i < limited.length; i += BATCH) {
    const batch = limited.slice(i, i + BATCH).map((r) => trimRow(r, columns));
    const { error: insErr } = await supabase.from("products").insert(batch);
    if (insErr) {
      console.error(`Insert batch ${i / BATCH + 1} failed:`, insErr.message);
      console.error(insErr);
      process.exit(1);
    }
    ok += batch.length;
    process.stdout.write(`\rInserted ${ok}/${limited.length}`);
  }
  console.log("\nDone. Upload images if needed: npm run upload:supplier-images -- --supplier=blue-whale");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

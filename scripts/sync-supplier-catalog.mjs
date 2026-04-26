/**
 * Scan data/supplier/<supplier>/<imagesSubdir>/… and upsert `products` in Supabase.
 *
 * Per-supplier settings: data/supplier/<supplier>/catalog.config.json
 * (copy data/supplier/_template/catalog.config.example.json).
 *
 * Images:
 *   --images=local    → /api/supplier-media/<supplier>/… (307 to Supabase public URL; objects must exist in bucket)
 *   --images=storage  → https://…/storage/v1/object/public/<bucket>/<supplier>/…
 *
 * Usage:
 *   npm run sync:supplier -- --supplier=fashion-biz --dry-run
 *   npm run sync:fashion-biz -- --dry-run
 *   npm run sync:syzmik   → same supplier, only `images/Syzmik/…`
 *   npm run sync:supplier -- --supplier=fashion-biz --images=storage
 *   npm run sync:supplier -- --supplier=fashion-biz --only-brand=Biz Collection
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      SUPPLIER_IMAGES_BUCKET (default: supplier-product-images)
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, sep, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/** Biz Care folder SKUs → DB category Scrubs (Women's scrubs; NBCF/indent section defaults otherwise). */
const BIZ_CARE_WOMENS_SCRUBS_SKUS = new Set(["CSP102UL", "CST250US", "CST313MS"]);

const BIZ_CARE_MENS_SCRUBS_SKUS = new Set(["CT247ML"]);

/** Biz Care SKUs → PPE / Miscellaneous (see `isBizCareListingInMiscGeneratedSet`). */
const BIZ_CARE_PPE_MISCELLANEOUS_SKUS = new Set(["C602W", "C603U"]);

function loadBizCollectionForceJacketsSkus() {
  const p = join(getBossWebRoot(), "lib", "biz-collection-force-jackets.json");
  if (!existsSync(p)) {
    return new Set();
  }
  const arr = JSON.parse(readFileSync(p, "utf8"));
  return new Set(arr.map((s) => String(s).toUpperCase()));
}

function loadBizCollectionKidsOnlyJacketsSkus() {
  const p = join(getBossWebRoot(), "lib", "biz-collection-kids-only-jackets.json");
  if (!existsSync(p)) {
    return new Set();
  }
  const arr = JSON.parse(readFileSync(p, "utf8"));
  return new Set(arr.map((s) => String(s).toUpperCase()));
}

/** Biz Collection SKUs → DB Jackets (see `lib/biz-collection-force-jackets.json`). */
const BIZ_COLLECTION_FORCE_JACKETS_SKUS = loadBizCollectionForceJacketsSkus();

/** Kid's-only jacket SKUs (see `lib/biz-collection-kids-only-jackets.json`). */
const BIZ_COLLECTION_KIDS_ONLY_JACKETS_SKUS = loadBizCollectionKidsOnlyJacketsSkus();

function loadBizCollectionKidsOnlyPantsSkus() {
  const p = join(getBossWebRoot(), "lib", "biz-collection-kids-only-pants.json");
  if (!existsSync(p)) {
    return new Set();
  }
  const arr = JSON.parse(readFileSync(p, "utf8"));
  return new Set(arr.map((s) => String(s).toUpperCase()));
}

/** Kid's-only pants SKUs (see `lib/biz-collection-kids-only-pants.json`). */
const BIZ_COLLECTION_KIDS_ONLY_PANTS_SKUS = loadBizCollectionKidsOnlyPantsSkus();

function loadBizCollectionKidsOnlyTShirtsSkus() {
  const p = join(getBossWebRoot(), "lib", "biz-collection-kids-only-t-shirts.json");
  if (!existsSync(p)) {
    return new Set();
  }
  const arr = JSON.parse(readFileSync(p, "utf8"));
  return new Set(arr.map((s) => String(s).toUpperCase()));
}

/** Kid's-only T-shirts SKUs (see `lib/biz-collection-kids-only-t-shirts.json`). */
const BIZ_COLLECTION_KIDS_ONLY_T_SHIRTS_SKUS = loadBizCollectionKidsOnlyTShirtsSkus();

function loadFashionBizWomensTShirtsSkus() {
  const p = join(getBossWebRoot(), "lib", "fashion-biz-womens-t-shirts.json");
  if (!existsSync(p)) {
    return new Set();
  }
  const arr = JSON.parse(readFileSync(p, "utf8"));
  return new Set(arr.map((s) => String(s).toUpperCase()));
}

/** Women's/T-shirts (Biz Care + Biz Collection; see `lib/fashion-biz-womens-t-shirts.json`). */
const FASHION_BIZ_WOMENS_T_SHIRTS_SKUS = loadFashionBizWomensTShirtsSkus();

function loadBizCollectionForcePantsSkus() {
  const p = join(getBossWebRoot(), "lib", "biz-collection-force-pants.json");
  if (!existsSync(p)) {
    return new Set();
  }
  const arr = JSON.parse(readFileSync(p, "utf8"));
  return new Set(arr.map((s) => String(s).toUpperCase()));
}

const BIZ_COLLECTION_FORCE_PANTS_SKUS = loadBizCollectionForcePantsSkus();

function normalizedBizCollectionSkuFolder(sku) {
  return String(sku).toUpperCase().replace(/-CLEARANCE$/i, "");
}

const SKIP_DIR_NAMES = new Set([".ds_store"]);

loadEnvLocal();

function parseArgs(argv) {
  const out = {
    supplier: null,
    dryRun: false,
    limit: Infinity,
    images: "local",
    bucket: process.env.SUPPLIER_IMAGES_BUCKET ?? "supplier-product-images",
    /** If set, only scan `images/<this top-level folder>/…` (e.g. `Syzmik` under fashion-biz). */
    onlyBrand: null,
  };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a.startsWith("--supplier=")) {
      out.supplier = a.split("=")[1]?.trim() || null;
    } else if (a.startsWith("--only-brand=")) {
      out.onlyBrand = a.split("=")[1]?.trim() || null;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.split("=")[1]);
      out.limit = Number.isFinite(n) && n > 0 ? n : Infinity;
    } else if (a.startsWith("--images=")) {
      const m = a.split("=")[1]?.trim().toLowerCase();
      if (m === "storage" || m === "local") {
        out.images = m;
      }
    } else if (a.startsWith("--bucket=")) {
      out.bucket = a.split("=")[1]?.trim() || out.bucket;
    }
  }
  return out;
}

function loadCatalogConfig(supplier) {
  const root = getBossWebRoot();
  const path = join(root, "data", "supplier", supplier, "catalog.config.json");
  const fallbackPrefix = supplier.replace(/[^a-z0-9]+/gi, "").toLowerCase().slice(0, 16) || "sku";
  if (!existsSync(path)) {
    return {
      productSlugPrefix: fallbackPrefix,
      displayName: supplier,
      skipTopLevelFolders: [],
      imagesSubdir: "images",
      descriptionTemplate: "{name} — {displayName} catalog ({section}).",
    };
  }
  const j = JSON.parse(readFileSync(path, "utf8"));
  return {
    productSlugPrefix: String(j.productSlugPrefix ?? fallbackPrefix),
    displayName: String(j.displayName ?? supplier),
    skipTopLevelFolders: Array.isArray(j.skipTopLevelFolders)
      ? j.skipTopLevelFolders.map((s) => String(s).toLowerCase())
      : [],
    imagesSubdir: String(j.imagesSubdir ?? "images").replace(/^\/+|\/+$/g, ""),
    descriptionTemplate: String(
      j.descriptionTemplate ?? "{name} — {displayName} catalog ({section}).",
    ),
  };
}

function slugifySegment(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugifyBrand(brand) {
  return slugifySegment(brand).replace(/-/g, "") || "brand";
}

/**
 * Derive `products.category` from Fashion Biz `style_name` (CSV col 3) for Syzmik SKUs.
 * Fixes "01 Shirts + Polos" folders where ZH145 is a polo but ZH135 is a tee.
 */
function dbCategoryFromSyzmikStyleName(styleName) {
  const n = String(styleName).toLowerCase();
  if (!n.trim()) {
    return null;
  }
  if (n.includes("polo")) {
    return "Polos";
  }
  if (n.includes("t-shirt") || /\btee\b/.test(n)) {
    return "T-shirts";
  }
  if (n.includes("scrub")) {
    return "Scrubs";
  }
  if (n.includes("overall")) {
    return "Work Shirts";
  }
  if ((n.includes("hi vis") || n.includes("hi-vis")) && n.includes("vest") && !n.includes("polo")) {
    return "Hi-vis Vest";
  }
  if (n.includes("jacket") || n.includes("fleece") || n.includes("hoodie")) {
    return "Jackets";
  }
  if (n.includes("pant") || n.includes("short")) {
    return "Pants";
  }
  if (n.includes("boot")) {
    return "Boots";
  }
  if (n.includes("glove")) {
    return "Glove";
  }
  if (n.includes("glass")) {
    return "Safty Glasses";
  }
  if (/\b(hat|cap|beanie|helmet|hard hat|balaclava|head wear|headwear)\b/.test(n)) {
    return "Head Wear";
  }
  if (n.includes("sock")) {
    return "Miscellaneous";
  }
  if (n.includes("chef") || n.includes("apron")) {
    return "Chef";
  }
  if (n.includes("shirt")) {
    return "Work Shirts";
  }
  return null;
}

function splitCsvFields(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** style_code (uppercase) → DB category label from local `data/supplier/fashion-biz/csv/*syzmik*.csv` */
function loadSyzmikStyleCategoryMap(root) {
  const map = new Map();
  const csvDir = join(root, "data", "supplier", "fashion-biz", "csv");
  if (!existsSync(csvDir)) {
    return map;
  }
  let files;
  try {
    files = readdirSync(csvDir).filter(
      (f) => f.toLowerCase().includes("syzmik") && f.toLowerCase().endsWith(".csv"),
    );
  } catch {
    return map;
  }
  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(csvDir, file), "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let li = 1; li < lines.length; li += 1) {
      const line = lines[li];
      if (!line.trim()) {
        continue;
      }
      const cols = splitCsvFields(line);
      if (cols.length < 3) {
        continue;
      }
      const styleCode = cols[1]?.trim();
      const styleName = cols[2]?.trim();
      if (!styleCode || !styleName) {
        continue;
      }
      const cat = dbCategoryFromSyzmikStyleName(styleName);
      if (cat) {
        map.set(styleCode.toUpperCase(), cat);
      }
    }
  }
  return map;
}

/**
 * style_code (uppercase) → `short_description` from Fashion Biz `*sum*.csv`
 * (`biz-care`, `biz-collection`, `syzmik`; columns: style, …, short_description).
 */
function loadFashionBizSumShortDescriptions(root) {
  const map = new Map();
  const csvDir = join(root, "data", "supplier", "fashion-biz", "csv");
  if (!existsSync(csvDir)) {
    return map;
  }
  let files;
  try {
    files = readdirSync(csvDir).filter((f) => {
      const l = f.toLowerCase();
      return (
        l.endsWith(".csv") &&
        l.includes("sum") &&
        (l.includes("biz-care") || l.includes("biz-collection") || l.includes("syzmik"))
      );
    });
  } catch {
    return map;
  }
  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(csvDir, file), "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let li = 1; li < lines.length; li += 1) {
      const line = lines[li];
      if (!line.trim()) {
        continue;
      }
      const cols = splitCsvFields(line);
      if (cols.length < 5) {
        continue;
      }
      const style = cols[0]?.trim();
      const shortDesc = cols[4]?.trim();
      if (!style || !shortDesc) {
        continue;
      }
      map.set(style.toUpperCase(), shortDesc);
    }
  }
  return map;
}

function normalizeSumSizeToken(raw) {
  if (raw == null) {
    return "";
  }
  const s = String(raw).trim();
  if (!s) {
    return "";
  }
  const upper = s.toUpperCase();
  if (upper === "FRE" || /^FREE(\s+SIZE)?$/i.test(s)) {
    return "One Size";
  }
  if (/^\d+$/.test(s)) {
    return String(Number.parseInt(s, 10));
  }
  return upper.replace(/\s+/g, "");
}

/**
 * style_code → size options from Fashion Biz `*sum*.csv` `size` column (`;`-separated).
 */
function loadFashionBizSumSizes(root) {
  const map = new Map();
  const csvDir = join(root, "data", "supplier", "fashion-biz", "csv");
  if (!existsSync(csvDir)) {
    return map;
  }
  let files;
  try {
    files = readdirSync(csvDir).filter((f) => {
      const l = f.toLowerCase();
      return (
        l.endsWith(".csv") &&
        l.includes("sum") &&
        (l.includes("biz-care") || l.includes("biz-collection") || l.includes("syzmik"))
      );
    });
  } catch {
    return map;
  }
  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(csvDir, file), "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    if (!lines.length) {
      continue;
    }
    const headerCols = splitCsvFields(lines[0]);
    const idxStyle = headerCols.findIndex((h) => String(h).trim().toLowerCase() === "style");
    const idxSize = headerCols.findIndex((h) => String(h).trim().toLowerCase() === "size");
    if (idxStyle < 0 || idxSize < 0) {
      continue;
    }
    for (let li = 1; li < lines.length; li += 1) {
      const line = lines[li];
      if (!line.trim()) {
        continue;
      }
      const cols = splitCsvFields(line);
      if (cols.length <= Math.max(idxStyle, idxSize)) {
        continue;
      }
      const style = String(cols[idxStyle] ?? "")
        .trim()
        .toUpperCase()
        .replace(/-CLEARANCE$/i, "");
      const sizeCell = String(cols[idxSize] ?? "").trim();
      if (!style || !sizeCell) {
        continue;
      }
      const sizes = sizeCell
        .split(";")
        .map((x) => normalizeSumSizeToken(x))
        .filter(Boolean);
      if (!sizes.length) {
        continue;
      }
      const prev = map.get(style);
      if (!prev) {
        map.set(style, sizes);
      } else {
        map.set(style, [...new Set([...prev, ...sizes])]);
      }
    }
  }
  return map;
}

function fallbackSizesWhenNoSumCsv(brand, sku, name) {
  const u = String(sku).toUpperCase();
  const b = String(brand).toLowerCase();
  const nm = String(name);
  if (u.includes("KS") || /\bkids?\b/i.test(nm)) {
    return ["4", "6", "8", "10", "12", "14", "16"];
  }
  if (b.includes("biz collection") && /LS$/i.test(u)) {
    return ["6", "8", "10", "12", "14", "16", "18", "20", "22", "24"];
  }
  if (b.includes("syzmik")) {
    return ["XS", "S", "M", "L", "XL", "2XL", "3XL", "5XL"];
  }
  return ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
}

function parseCsvPriceCell(raw) {
  if (raw == null) {
    return null;
  }
  const s = String(raw).trim();
  if (!s) {
    return null;
  }
  const n = Number.parseFloat(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * style_code (uppercase) → storefront `base_price` from Fashion Biz `*full*` / `*clearance*` CSVs
 * (uses `price1`; multiple size rows → minimum positive price per style).
 */
function loadFashionBizStyleBasePrices(root) {
  const map = new Map();
  const csvDir = join(root, "data", "supplier", "fashion-biz", "csv");
  if (!existsSync(csvDir)) {
    return map;
  }
  let files;
  try {
    files = readdirSync(csvDir).filter((f) => {
      const l = f.toLowerCase();
      if (!l.endsWith(".csv") || l.includes("sum")) {
        return false;
      }
      return l.includes("full") || l.includes("clearance");
    });
  } catch {
    return map;
  }
  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(csvDir, file), "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    if (!lines.length) {
      continue;
    }
    const headerCols = splitCsvFields(lines[0]);
    const idxStyle = headerCols.findIndex((h) => String(h).trim().toLowerCase() === "style_code");
    const idxPrice = headerCols.findIndex((h) => String(h).trim().toLowerCase() === "price1");
    if (idxStyle < 0 || idxPrice < 0) {
      continue;
    }
    for (let li = 1; li < lines.length; li += 1) {
      const line = lines[li];
      if (!line.trim()) {
        continue;
      }
      const cols = splitCsvFields(line);
      if (cols.length <= Math.max(idxStyle, idxPrice)) {
        continue;
      }
      const style = cols[idxStyle]?.trim();
      const price = parseCsvPriceCell(cols[idxPrice]);
      if (!style || price == null || price <= 0) {
        continue;
      }
      const key = style.toUpperCase();
      const prev = map.get(key);
      if (prev == null || price < prev) {
        map.set(key, price);
      }
    }
  }
  return map;
}

/** style_code (uppercase) → Fashion Biz style title (CSV col 3) from `*biz-care*.csv`. */
function loadBizCareSkuStyleTitles(root) {
  const map = new Map();
  const csvDir = join(root, "data", "supplier", "fashion-biz", "csv");
  if (!existsSync(csvDir)) {
    return map;
  }
  let files;
  try {
    files = readdirSync(csvDir).filter(
      (f) => f.toLowerCase().includes("biz-care") && f.toLowerCase().endsWith(".csv"),
    );
  } catch {
    return map;
  }
  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(csvDir, file), "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let li = 1; li < lines.length; li += 1) {
      const line = lines[li];
      if (!line.trim()) {
        continue;
      }
      const cols = splitCsvFields(line);
      if (cols.length < 3) {
        continue;
      }
      const styleCode = cols[1]?.trim();
      const styleName = cols[2]?.trim();
      if (!styleCode || !styleName) {
        continue;
      }
      map.set(styleCode.toUpperCase(), styleName);
    }
  }
  return map;
}

/** Biz Care CSV style title → DB `Miscellaneous` (socks, bags, hats / headwear). */
function isBizCareMiscStyleTitle(title) {
  const t = String(title);
  if (/\b(socks?|tote|bags?|backpack|rucksack|satchel)\b/i.test(t)) {
    return true;
  }
  if (/\b(hat|hats|cap|caps|beanie|beanies|visor|hijab|headwear|head wear|turban|beret)\b/i.test(t)) {
    return true;
  }
  return false;
}

function dbCategory(brandName, sectionName) {
  const s = sectionName.toLowerCase();
  const b = brandName.toLowerCase();

  if (b.includes("yes chef") || s.includes("apron") || s.includes("chefwear")) {
    return "Chef";
  }
  if (s.includes("scrub")) {
    return "Scrubs";
  }
  if (s.includes("outerwear") || /\bjackets\b/.test(s) || s.includes("fire armour") || s.includes("ttmc")) {
    return "Jackets";
  }
  if (s.includes("pants") || s.includes("shorts") || s.includes("lowers") || s.includes("overalls")) {
    return "Pants";
  }
  if (s === "01 polos" || (s.includes("polo") && !s.includes("shirt"))) {
    return "Polos";
  }
  if (s.includes("tees") || s.includes("t-tops") || s.includes("t tops")) {
    return "T-shirts";
  }
  if (s.includes("shirts + polos")) {
    return "Work Shirts";
  }
  if (s.includes("shirting") || s.includes("smart casual") || s.includes("suiting")) {
    return "Shirts";
  }
  if (s.includes("shirts") && !s.includes("polo")) {
    return "Shirts";
  }
  if (s.includes("activewear") || s.includes("casualwear")) {
    return "T-shirts";
  }
  if (s.includes("knitwear")) {
    return "Jackets";
  }
  if (s.includes("accessories") || s.includes("health") || s.includes("beauty")) {
    return b.includes("yes chef") ? "Chef" : "Scrubs";
  }
  if (s.includes("indent") || s.includes("nbcf")) {
    return "T-shirts";
  }
  return "Work Shirts";
}

function humanizeColor(raw) {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
}

/** Colors from flat-lay (`_Product_`) and on-model (`_Talent_`) — same naming for Biz + Syzmik folders. */
function colorsFromFiles(files) {
  const colors = new Set();
  const re = /_(?:Product|Talent)_([A-Za-z0-9]+)_/i;
  for (const f of files) {
    const m = f.match(re);
    if (m) {
      colors.add(humanizeColor(m[1]));
    }
  }
  return [...colors].sort();
}

function publicStorageUrlFor(supabaseUrl, bucket, supplierSlug, relUnix) {
  const base = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}`;
  const parts = [supplierSlug, ...relUnix.split("/").filter(Boolean)].map((p) =>
    encodeURIComponent(p.replace(/\\/g, "/")),
  );
  return `${base}/${parts.join("/")}`;
}

/** Max images per product in DB (product flat-lay + on-model / Talent + other supplier shots). */
const MAX_PRODUCT_GALLERY_IMAGES = 48;

/**
 * Gallery URL order for every scanned product folder (Biz Care, Biz Collection, Syzmik, …):
 * Talent / on-model first, then `_Product_` flat lays, then other images.
 */
function pickImagePaths(files, relDirUnix, supplierSlug, imageMode, supabaseUrl, bucket) {
  const images = files.filter((f) => IMG_EXT.has(extname(f).toLowerCase()));
  const talentShots = images.filter((f) => /Talent/i.test(f));
  const productShots = images.filter((f) => /_Product_/i.test(f) && !/Talent/i.test(f));
  const otherShots = images.filter(
    (f) => !/_Product_/i.test(f) && !/Talent/i.test(f),
  );
  let ordered;
  if (productShots.length > 0 || talentShots.length > 0) {
    // On-model / lifestyle first (upload + gallery order), then flat product shots.
    ordered = [
      ...talentShots.slice().sort((a, b) => a.localeCompare(b)),
      ...productShots.slice().sort((a, b) => a.localeCompare(b)),
      ...otherShots.slice().sort((a, b) => a.localeCompare(b)),
    ];
  } else {
    ordered = images.slice().sort((a, b) => a.localeCompare(b));
  }
  return ordered.slice(0, MAX_PRODUCT_GALLERY_IMAGES).map((f) => {
    const rel = posix.join(relDirUnix, f).replace(/\/+/g, "/");
    if (imageMode === "storage") {
      if (!supabaseUrl) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL is required when --images=storage");
      }
      return publicStorageUrlFor(supabaseUrl, bucket, supplierSlug, rel);
    }
    return `/api/supplier-media/${supplierSlug}/${rel}`;
  });
}

function listLeafProductDirs(dir, baseImagesPath, out) {
  const name = basename(dir);
  if (name.startsWith(".")) {
    return;
  }
  const lower = name.toLowerCase();
  if (SKIP_DIR_NAMES.has(lower)) {
    return;
  }

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  const subdirs = [];
  const files = [];
  for (const ent of entries) {
    const p = join(dir, ent);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!ent.startsWith(".")) {
        subdirs.push(p);
      }
    } else {
      files.push(ent);
    }
  }

  const hasImages = files.some((f) => IMG_EXT.has(extname(f).toLowerCase()));

  if (subdirs.length) {
    for (const s of subdirs) {
      listLeafProductDirs(s, baseImagesPath, out);
    }
    return;
  }

  if (!hasImages) {
    return;
  }

  const relFromImages = relative(baseImagesPath, dir);
  if (relFromImages.startsWith("..")) {
    return;
  }
  const parts = relFromImages.split(sep).filter(Boolean);
  if (parts.length < 3) {
    return;
  }

  const brand = parts[0];
  const section = parts[1];
  const sku = parts[parts.length - 1];

  out.push({
    brand,
    section,
    sku,
    files,
    relPosix: relFromImages.split(sep).join("/"),
  });
}

function buildRow(
  entry,
  cfg,
  supplierSlug,
  imageMode,
  supabaseUrl,
  bucket,
  syzmikStyleCategoryMap,
  bizCareStyleTitles,
  bizSumShortDescriptions,
  bizSumSizes,
  bizStyleBasePrices,
) {
  const { brand, section, sku, files, relPosix } = entry;
  let category = dbCategory(brand, section);
  const brandLower = String(brand).toLowerCase();
  if (brandLower.includes("syzmik") && syzmikStyleCategoryMap?.size) {
    const hint = syzmikStyleCategoryMap.get(String(sku).toUpperCase());
    if (hint) {
      category = hint;
    }
  }
  // Syzmik SKU heuristics (folder names sometimes group tees under shirts).
  const syzSku = String(sku).toUpperCase();
  if (brandLower.includes("syzmik") && syzSku.startsWith("ZT")) {
    category = "T-shirts";
  } else if (brandLower.includes("syzmik") && syzSku.startsWith("ZH")) {
    // Most Syzmik ZH lines are polos in the "Shirts + Polos" folder.
    category = "Polos";
  } else if (brandLower.includes("syzmik") && syzSku.includes("ZWL")) {
    category = "Pants";
  } else if (brandLower.includes("syzmik") && syzSku.includes("ZW")) {
    category = "Shirts";
  } else if (brandLower.includes("syzmik") && syzSku.includes("ZA")) {
    category = "Miscellaneous";
  }
  if (brandLower.includes("biz collection")) {
    const normSku = normalizedBizCollectionSkuFolder(sku);
    if (
      BIZ_COLLECTION_FORCE_JACKETS_SKUS.has(normSku) ||
      BIZ_COLLECTION_KIDS_ONLY_JACKETS_SKUS.has(normSku)
    ) {
      category = "Jackets";
    }
    if (
      BIZ_COLLECTION_FORCE_PANTS_SKUS.has(normSku) ||
      BIZ_COLLECTION_KIDS_ONLY_PANTS_SKUS.has(normSku)
    ) {
      category = "Pants";
    }
    if (BIZ_COLLECTION_KIDS_ONLY_T_SHIRTS_SKUS.has(normSku)) {
      category = "T-shirts";
    }
    if (normSku.toUpperCase().includes("TP")) {
      category = "Pants";
    }
  }
  if (brandLower.includes("biz care") && bizCareStyleTitles?.size) {
    const styleTitle = bizCareStyleTitles.get(String(sku).toUpperCase()) ?? "";
    if (isBizCareMiscStyleTitle(styleTitle)) {
      category = "Miscellaneous";
    }
  }
  if (
    brandLower.includes("biz care") &&
    (BIZ_CARE_WOMENS_SCRUBS_SKUS.has(String(sku).toUpperCase()) ||
      BIZ_CARE_MENS_SCRUBS_SKUS.has(String(sku).toUpperCase()))
  ) {
    category = "Scrubs";
  }
  if (
    brandLower.includes("biz care") &&
    BIZ_CARE_PPE_MISCELLANEOUS_SKUS.has(String(sku).toUpperCase())
  ) {
    category = "Miscellaneous";
  }
  if (
    (brandLower.includes("biz care") || brandLower.includes("biz collection")) &&
    FASHION_BIZ_WOMENS_T_SHIRTS_SKUS.has(String(sku).toUpperCase())
  ) {
    category = "T-shirts";
  }
  const titleBrand = brand === "Syzmik" ? "Syzmik" : brand;
  const name = `${titleBrand} ${sku}`;
  const skuPart = sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = `${cfg.productSlugPrefix}-${slugifyBrand(brand)}-${skuPart}`;
  const relUnderImages = posix.join(cfg.imagesSubdir, relPosix);
  const imageUrls = pickImagePaths(files, relUnderImages, supplierSlug, imageMode, supabaseUrl, bucket);
  const availableColors = colorsFromFiles(files);
  const fallbackColors =
    availableColors.length > 0 ? availableColors : ["Black", "Navy", "Charcoal", "White", "Grey"];

  const sumTitle = (bizSumShortDescriptions?.get(String(sku).toUpperCase()) ?? "").trim();
  const baseDescription = cfg.descriptionTemplate
    .replace(/\{name\}/g, name)
    .replace(/\{displayName\}/g, cfg.displayName)
    .replace(/\{section\}/g, section)
    .replace(/\{brand\}/g, brand)
    .replace(/\{sku\}/g, sku);
  const description = sumTitle ? `${sumTitle}\n\n${baseDescription}` : baseDescription;

  const styleKeyForPrice = String(sku).toUpperCase().replace(/-CLEARANCE$/i, "");
  const fromCsvPrice = bizStyleBasePrices?.get(styleKeyForPrice) ?? null;
  const resolvedPrice =
    typeof fromCsvPrice === "number" && Number.isFinite(fromCsvPrice) && fromCsvPrice > 0
      ? Math.round(fromCsvPrice * 100) / 100
      : undefined;

  const sumSizes = bizSumSizes?.get(styleKeyForPrice);
  const available_sizes =
    sumSizes && sumSizes.length > 0 ? sumSizes : fallbackSizesWhenNoSumCsv(brand, sku, name);

  return {
    name,
    slug,
    category,
    description,
    ...(resolvedPrice !== undefined ? { base_price: resolvedPrice } : {}),
    weight_kg: null,
    image_urls: imageUrls,
    available_colors: fallbackColors,
    available_sizes,
    is_active: true,
    // Brand label for storefront filters + Admin supplier sheets.
    supplier_name: titleBrand,
  };
}

async function getProductColumns(supabase) {
  const { data, error } = await supabase.from("products").select("*").limit(1);
  if (error) {
    throw new Error(error.message);
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
    ]);
  }
  return new Set(Object.keys(data[0]));
}

function trimRow(row, columns) {
  const o = {};
  for (const k of Object.keys(row)) {
    if (!columns.has(k)) {
      continue;
    }
    const v = row[k];
    if (v === undefined) {
      continue;
    }
    o[k] = v;
  }
  if (columns.has("stock_quantity") && o.stock_quantity === undefined) {
    o.stock_quantity = 0;
  }
  return o;
}

/**
 * Insert/update catalog rows: match existing by `slug` first, then `name`, then PK upsert.
 * Avoids duplicate-slug inserts when legacy rows have a different `name` for the same SKU slug.
 */
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
  let supplier = args.supplier;
  if (!supplier) {
    console.error("Missing --supplier=<folder under data/supplier/>");
    console.error("Example: npm run sync:supplier -- --supplier=fashion-biz");
    process.exit(1);
  }

  supplier = supplier.replace(/^\/+|\/+$/g, "");
  const cfg = loadCatalogConfig(supplier);
  const root = getBossWebRoot();
  const IMAGES_ROOT = join(root, "data", "supplier", supplier, cfg.imagesSubdir);

  if (!existsSync(IMAGES_ROOT)) {
    console.error("Missing folder:", IMAGES_ROOT);
    process.exit(1);
  }

  const skipTop = new Set(cfg.skipTopLevelFolders);
  const leaves = [];
  for (const t of readdirSync(IMAGES_ROOT)) {
    const p = join(IMAGES_ROOT, t);
    if (args.onlyBrand && t.toLowerCase() !== String(args.onlyBrand).toLowerCase()) {
      continue;
    }
    if (skipTop.has(t.toLowerCase())) {
      continue;
    }
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      listLeafProductDirs(p, IMAGES_ROOT, leaves);
    }
  }

  leaves.sort((a, b) => a.relPosix.localeCompare(b.relPosix));
  const limited = leaves.slice(0, args.limit);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const syzmikStyleCategoryMap = loadSyzmikStyleCategoryMap(root);
  if (syzmikStyleCategoryMap.size > 0) {
    console.log(`Syzmik CSV style→category hints loaded: ${syzmikStyleCategoryMap.size} style codes`);
  }

  const bizCareStyleTitles = loadBizCareSkuStyleTitles(root);
  if (bizCareStyleTitles.size > 0) {
    console.log(`Biz Care CSV style titles loaded: ${bizCareStyleTitles.size} style codes`);
  }

  const bizSumShortDescriptions = loadFashionBizSumShortDescriptions(root);
  if (bizSumShortDescriptions.size > 0) {
    console.log(`Fashion Biz sum.csv short descriptions: ${bizSumShortDescriptions.size} style codes`);
  }

  const bizSumSizes = loadFashionBizSumSizes(root);
  if (bizSumSizes.size > 0) {
    console.log(`Fashion Biz sum.csv sizes: ${bizSumSizes.size} style codes`);
  }

  const bizStyleBasePrices = loadFashionBizStyleBasePrices(root);
  if (bizStyleBasePrices.size > 0) {
    console.log(`Fashion Biz CSV style→price1 (base_price): ${bizStyleBasePrices.size} style codes`);
  }

  const rows = limited.map((e) =>
    buildRow(
      e,
      cfg,
      supplier,
      args.images,
      supabaseUrl,
      args.bucket,
      syzmikStyleCategoryMap,
      bizCareStyleTitles,
      bizSumShortDescriptions,
      bizSumSizes,
      bizStyleBasePrices,
    ),
  );

  console.log(
    `Supplier "${supplier}": ${leaves.length} products (processing ${rows.length}); images=${args.images}`,
  );

  if (args.dryRun) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Warning: using anon key; upsert may fail under RLS.");
  }
  if (args.images === "storage" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("--images=storage requires NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const columns = await getProductColumns(supabase);
  const batches = [];
  const BATCH = 40;
  for (let i = 0; i < rows.length; i += BATCH) {
    batches.push(rows.slice(i, i + BATCH).map((r) => trimRow(r, columns)));
  }

  let ok = 0;
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    try {
      await upsertProductsBatch(supabase, batch);
    } catch (e) {
      console.error(`Batch ${i + 1} failed:`, e instanceof Error ? e.message : e);
      process.exit(1);
    }
    ok += batch.length;
    process.stdout.write(`\rUpserted ${ok}/${rows.length}`);
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

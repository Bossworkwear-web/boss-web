/**
 * Insert or upsert products from a JSON file into Supabase `products`.
 *
 * Setup: `.env.local` with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * (service role recommended so INSERT/upsert is not blocked by RLS).
 *
 * Run from repo root:
 *   npm run import:products -- scripts/products.import.example.json
 *
 * Copy `scripts/products.import.example.json` → `scripts/products.import.json`,
 * edit rows, then import (products.import.json is gitignored).
 *
 * Field notes:
 * - `name` (required): display name; must be unique per DB constraint.
 * - `slug` (optional): URL key; defaults to a slug derived from `name`. Must be unique.
 * - `category`: use labels the site expects (e.g. "Polos", "Work Shirts", "T-shirts").
 * - Arrays: `image_urls`, `available_colors`, `available_sizes` as JSON arrays.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, "..", ".env.local");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function boolOrDefault(v, d) {
  if (typeof v === "boolean") {
    return v;
  }
  return d;
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
    ]);
  }
  return new Set(Object.keys(data[0]));
}

function buildRow(raw, columns) {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) {
    throw new Error("Every product needs a non-empty string `name`.");
  }

  const row = { name };

  const slugSource = typeof raw.slug === "string" && raw.slug.trim() ? raw.slug.trim() : slugify(name);
  if (columns.has("slug")) {
    row.slug = slugify(slugSource) || slugify(name);
  }
  if (columns.has("category") && raw.category != null && String(raw.category).trim()) {
    row.category = String(raw.category).trim();
  }
  if (columns.has("description") && raw.description != null && String(raw.description).trim()) {
    row.description = String(raw.description).trim();
  }
  if (columns.has("base_price")) {
    row.base_price = numOrNull(raw.base_price);
  }
  if (columns.has("weight_kg")) {
    row.weight_kg = numOrNull(raw.weight_kg);
  }
  if (columns.has("stock_quantity")) {
    const q = raw.stock_quantity;
    row.stock_quantity =
      q === null || q === undefined || q === "" ? 0 : Math.max(0, Math.floor(Number(q)) || 0);
  }
  if (columns.has("image_urls") && Array.isArray(raw.image_urls)) {
    row.image_urls = raw.image_urls.map((u) => String(u));
  }
  if (columns.has("available_colors") && Array.isArray(raw.available_colors)) {
    row.available_colors = raw.available_colors.map((c) => String(c));
  }
  if (columns.has("available_sizes") && Array.isArray(raw.available_sizes)) {
    row.available_sizes = raw.available_sizes.map((s) => String(s));
  }
  if (columns.has("is_active")) {
    row.is_active = boolOrDefault(raw.is_active, true);
  }
  if (columns.has("sort_order") && raw.sort_order !== undefined && raw.sort_order !== null) {
    const s = Number(raw.sort_order);
    if (Number.isFinite(s)) {
      row.sort_order = Math.trunc(s);
    }
  }

  return row;
}

async function run() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: node scripts/import-products.mjs <path-to.json>");
    console.error("Example: npm run import:products -- scripts/products.import.example.json");
    process.exit(1);
  }

  const jsonPath = resolve(process.cwd(), fileArg);
  if (!existsSync(jsonPath)) {
    console.error(`File not found: ${jsonPath}`);
    process.exit(1);
  }

  let list;
  try {
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    list = Array.isArray(parsed) ? parsed : parsed.products;
    if (!Array.isArray(list)) {
      throw new Error("JSON must be an array of products, or { \"products\": [...] }");
    }
  } catch (e) {
    console.error("Invalid JSON:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or key in environment (.env.local).");
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "Tip: Set SUPABASE_SERVICE_ROLE_KEY in .env.local if INSERT fails with RLS / permission errors.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const columns = await getProductColumns(supabase);
  const rows = [];
  for (let i = 0; i < list.length; i += 1) {
    try {
      rows.push(buildRow(list[i], columns));
    } catch (e) {
      console.error(`Row ${i + 1}: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  }

  const { data, error } = await supabase.from("products").insert(rows).select("id, name");

  if (error) {
    console.error("Insert failed:", error.message);
    console.error(error);
    process.exit(1);
  }

  console.log(`Inserted ${data?.length ?? rows.length} product(s).`);
  for (const r of data ?? []) {
    console.log(`  - ${r.name} (${r.id})`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

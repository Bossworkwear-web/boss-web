/**
 * Sync Headwear catalog via Xada REST API → Supabase `products`.
 *
 * API: https://api.xada.app/api/v1
 * Auth: Authorization: Bearer <HEADWEAR_XADA_API_KEY>
 *
 * Env:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - HEADWEAR_XADA_API_KEY (or HEADWEAR_PROMOSTANDARDS_PASSWORD)
 * - HEADWEAR_XADA_API_BASE_URL (optional)
 *
 * Usage:
 *   npm run sync:headwear -- --dry-run --limit=10
 *   npm run sync:headwear -- --dry-run
 *   npm run sync:headwear
 */
import { createClient } from "@supabase/supabase-js";

import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

const DEFAULT_BASE = "https://api.xada.app/api/v1";

function parseArgs(argv) {
  const out = { dryRun: false, pageSize: 50, maxPages: null, maxProducts: null };
  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") out.dryRun = true;
    else if (raw.startsWith("--page-size=")) {
      out.pageSize = Math.max(1, Math.min(100, Number(raw.split("=")[1]) || 50));
    } else if (raw.startsWith("--limit=")) {
      const n = Number(raw.split("=")[1]);
      if (Number.isFinite(n) && n > 0) out.maxProducts = Math.floor(n);
    } else if (raw.startsWith("--max-pages=")) {
      const v = Number(raw.split("=")[1]);
      out.maxPages = Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
    }
  }
  return out;
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'");
}

function htmlToPlainText(html) {
  const s = String(html || "");
  if (!s) return "";
  const normalized = s
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<\s*li\s*>/gi, "- ")
    .replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(normalized).replace(/\n{3,}/g, "\n\n").trim();
}

function uniq(list) {
  return [...new Set(list)];
}

function dedupeOrderedHttpUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const raw of urls) {
    const u = String(raw ?? "").trim();
    if (!u.startsWith("http") || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function customFieldValue(customFields, fieldName) {
  const list = Array.isArray(customFields) ? customFields : [];
  const want = fieldName.trim().toLowerCase();
  for (const row of list) {
    const field = String(row?.field ?? "").trim().toLowerCase();
    if (field === want) {
      return String(row?.value ?? "").trim();
    }
  }
  return "";
}

function inferAudience(product) {
  const age = customFieldValue(product?.custom_fields, "Age Range").toLowerCase();
  if (age.includes("youth") || age.includes("kid") || age.includes("child")) return "kids";
  const cats = (product?.categories ?? []).join(" ").toLowerCase();
  if (/\bkids?\b|\byouth\b|\bchildren\b/.test(cats)) return "kids";
  return "unisex";
}

function weightKgFromPackaging(packaging) {
  const w = packaging?.product?.weight;
  const value = Number(String(w?.value ?? "").trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = String(w?.unit ?? "").trim().toLowerCase();
  if (unit === "kg" || unit === "kilogram" || unit === "kilograms") return Math.round(value * 1000) / 1000;
  if (unit === "g" || unit === "gram" || unit === "grams") return Math.round((value / 1000) * 1000) / 1000;
  if (unit === "lb" || unit === "lbs" || unit === "pound" || unit === "pounds") {
    return Math.round(value * 0.453592 * 1000) / 1000;
  }
  return null;
}

function buildImageUrls(product, colours) {
  const ordered = [];
  const hero = String(product?.hero_image ?? "").trim();

  for (const colour of colours) {
    const u = String(colour?.image_url ?? "").trim();
    if (u.startsWith("http")) ordered.push(u);
  }

  for (const img of product?.images ?? []) {
    const u = String(img?.url ?? "").trim();
    if (u.startsWith("http")) ordered.push(u);
  }

  for (const v of product?.variants ?? []) {
    const u = String(v?.image_url ?? "").trim();
    if (u.startsWith("http")) ordered.push(u);
  }

  // Lifestyle hero after per-colour variant shots — leading hero shifts PDP colour ↔ gallery index.
  if (hero.startsWith("http")) {
    ordered.push(hero);
  }

  return dedupeOrderedHttpUrls(ordered);
}

function coloursFromVariants(product) {
  const seen = new Set();
  const out = [];
  for (const v of product?.variants ?? []) {
    const name = String(v?.colour ?? v?.color ?? "").trim();
    const image_url = String(v?.image_url ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, image_url });
  }
  return out;
}

function buildProductRow(product) {
  const styleSku = String(product?.sku ?? "").trim();
  const name = String(product?.name ?? "").trim();
  const coloursFromApi = [...(product?.colours ?? [])]
    .map((c) => ({
      name: String(c?.name ?? "").trim(),
      image_url: String(c?.image_url ?? "").trim(),
    }))
    .filter((c) => c.name);
  const colours = coloursFromApi.length ? coloursFromApi : coloursFromVariants(product);

  const colorNames = colours.length
    ? uniq(colours.map((c) => c.name))
    : uniq(
        (product?.variants ?? [])
          .map((v) => String(v?.colour ?? v?.color ?? "").trim())
          .filter(Boolean),
      );

  const sizes = uniq(
    [
      ...(Array.isArray(product?.sizes) ? product.sizes : []),
      ...(product?.variants ?? []).map((v) => String(v?.size ?? "").trim()),
    ].filter(Boolean),
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const variantPrices = (product?.variants ?? [])
    .map((v) => Number(v?.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  const basePrice = variantPrices.length ? Math.min(...variantPrices) : null;

  const imageUrls = buildImageUrls(product, colours);
  const slugBase = styleSku ? `hw-${slugify(styleSku)}` : `hw-${slugify(name)}`;
  const slug = slugBase || `hw-${product?.id ?? Math.random().toString(16).slice(2)}`;

  const body = htmlToPlainText(product?.description);
  const headerBits = [
    styleSku ? `Style: ${styleSku}` : "",
    product?.brand ? `Brand: ${String(product.brand).trim()}` : "",
    (product?.categories ?? []).length ? `Categories: ${(product.categories ?? []).join(", ")}` : "",
  ].filter(Boolean);
  const description = headerBits.length ? `${headerBits.join("\n")}\n\n${body}`.trim() : body;

  const discontinued = Boolean(product?.status?.discontinued);
  const audience = inferAudience(product);
  const weightKg = weightKgFromPackaging(product?.packaging);

  return {
    name: name || `Headwear ${styleSku}`.trim(),
    slug,
    category: "Head Wear",
    description,
    ...(basePrice != null ? { base_price: Math.round(basePrice * 100) / 100 } : {}),
    ...(weightKg != null ? { weight_kg: weightKg } : {}),
    stock_quantity: 0,
    image_urls: imageUrls,
    available_colors: colorNames.length ? colorNames : ["Black", "Navy", "White"],
    available_sizes: sizes.length ? sizes : ["One Size"],
    ...(audience ? { audience } : {}),
    is_active: !discontinued && imageUrls.length > 0,
    supplier_name: "Headwear",
  };
}

async function getProductColumns(supabase) {
  const { data, error } = await supabase.from("products").select("*").limit(1);
  if (error) throw new Error(error.message);
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
      "supplier_name",
      "audience",
    ]);
  }
  return new Set(Object.keys(data[0]));
}

function trimRow(row, columns) {
  const o = {};
  for (const k of Object.keys(row)) {
    if (!columns.has(k)) continue;
    const v = row[k];
    if (v === undefined) continue;
    o[k] = v;
  }
  if (columns.has("stock_quantity") && o.stock_quantity === undefined) {
    o.stock_quantity = 0;
  }
  return o;
}

function isHeadwearSyncRow(row) {
  const sup = String(row?.supplier_name ?? "").trim().toLowerCase();
  const slug = String(row?.slug ?? "").trim().toLowerCase();
  return sup === "headwear" || slug.startsWith("hw-");
}

async function upsertProductsBatch(supabase, batch) {
  const deduped = [...new Map(batch.map((r) => [r.slug, r])).values()];
  if (!deduped.length) return;

  const names = deduped
    .filter((r) => !isHeadwearSyncRow(r))
    .map((r) => r.name);
  const slugs = [...new Set(deduped.map((r) => r.slug).filter(Boolean))];

  const { data: bySlug, error: slugErr } = slugs.length
    ? await supabase.from("products").select("id, name, slug").in("slug", slugs)
    : { data: [], error: null };
  if (slugErr) throw slugErr;
  const { data: byName, error: nameErr } = names.length
    ? await supabase.from("products").select("id, name, slug").in("name", names)
    : { data: [], error: null };
  if (nameErr) throw nameErr;

  const idBySlug = new Map((bySlug ?? []).filter((r) => r.slug).map((r) => [r.slug, r.id]));
  const idByName = new Map((byName ?? []).map((r) => [r.name, r.id]));

  const toInsert = [];
  const upsertById = new Map();
  for (const row of deduped) {
    const id =
      idBySlug.get(row.slug) ??
      (isHeadwearSyncRow(row) ? null : idByName.get(row.name));
    if (id) upsertById.set(id, { id, ...row });
    else toInsert.push(row);
  }
  const toUpsertById = [...upsertById.values()];

  if (toInsert.length) {
    const { error: insErr } = await supabase.from("products").insert(toInsert);
    if (insErr) throw insErr;
  }
  if (toUpsertById.length) {
    const { error: upErr } = await supabase.from("products").upsert(toUpsertById, { onConflict: "id" });
    if (upErr) throw upErr;
  }
}

async function fetchProductsPage(base, apiKey, page, pageSize) {
  const url = new URL(`${base.replace(/\/$/, "")}/products`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Xada /products page ${page} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return await res.json();
}

async function main() {
  const args = parseArgs(process.argv);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = (process.env.HEADWEAR_XADA_API_KEY ?? process.env.HEADWEAR_PROMOSTANDARDS_PASSWORD ?? "").trim();
  const base = (process.env.HEADWEAR_XADA_API_BASE_URL ?? DEFAULT_BASE).trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    process.exit(1);
  }
  if (!apiKey) {
    console.error("Missing HEADWEAR_XADA_API_KEY in .env.local.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const columns = await getProductColumns(supabase);

  let page = 1;
  let pageCount = 1;
  let totalRows = 0;
  const BATCH = 40;

  while (page <= pageCount) {
    if (args.maxPages && page > args.maxPages) break;
    if (args.maxProducts && totalRows >= args.maxProducts) break;

    const pageSize =
      args.maxProducts && args.maxProducts - totalRows < args.pageSize
        ? args.maxProducts - totalRows
        : args.pageSize;

    const json = await fetchProductsPage(base, apiKey, page, pageSize);
    const data = Array.isArray(json?.data) ? json.data : [];
    const tp = Number(json?.page_count);
    if (Number.isFinite(tp) && tp > 0) pageCount = tp;

    let rows = data.map(buildProductRow).map((r) => trimRow(r, columns));
    if (args.maxProducts) {
      rows = rows.slice(0, Math.max(0, args.maxProducts - totalRows));
    }
    totalRows += rows.length;

    if (args.dryRun) {
      for (const row of rows) {
        console.log(
          `[dry-run] ${row.slug} | ${row.name} | $${row.base_price ?? "—"} | colours: ${(row.available_colors ?? []).join(", ")} | images: ${(row.image_urls ?? []).length}`,
        );
      }
      console.log(`[dry-run] page ${page}/${pageCount}: ${rows.length} products`);
    } else {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        await upsertProductsBatch(supabase, batch);
      }
      console.log(`Synced page ${page}/${pageCount}: ${rows.length} products`);
    }

    if (args.maxProducts && totalRows >= args.maxProducts) break;
    page += 1;
  }

  console.log(args.dryRun ? `Dry-run complete (${totalRows} rows scanned).` : `Sync complete (${totalRows} rows).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Sync Aussie Pacific (Four Seasons) catalog via API → Supabase `products`.
 *
 * API docs: https://api.fourseasonstextiles.com.au/docs
 * Auth: Authorization: Bearer <token>
 *
 * Env:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (recommended)
 * - AUSSIE_PACIFIC_API_TOKEN
 *
 * Usage:
 *   npm run sync:aussie-pacific -- --dry-run
 *   npm run sync:aussie-pacific -- --limit=250
 */
import { createClient } from "@supabase/supabase-js";
import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";
import { maybeAppendAp2310BlackRedBackFallback } from "./lib/ap-2310-back-fallback.mjs";

loadEnvLocal();

const API_BASE = "https://api.fourseasonstextiles.com.au";

function parseArgs(argv) {
  const out = { dryRun: false, limit: 250, maxPages: null };
  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") out.dryRun = true;
    else if (raw.startsWith("--limit=")) out.limit = Math.max(1, Math.min(250, Number(raw.split("=")[1]) || 250));
    else if (raw.startsWith("--max-pages=")) {
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

function toTitleCase(s) {
  const raw = String(s || "").trim();
  if (!raw) return "";
  // Keep common abbreviations in place (e.g. "PPE", "UV", "Hi-Vis").
  if (/^[A-Z0-9-]{2,}$/.test(raw)) return raw;
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function inferDbCategory(mainCategory, subCategory, name) {
  const blob = [mainCategory, subCategory, name].filter(Boolean).join(" ").toLowerCase();
  if (/\bpolo(s)?\b/.test(blob)) return "Polos";
  if (/\b(t-?shirt|tee|singlet)\b/.test(blob)) return "T-shirts";
  if (/\bshirt(s)?\b/.test(blob) && !/\bt-?shirt\b/.test(blob)) return "Shirts";
  if (/\b(pant|pants|trouser|trousers|shorts)\b/.test(blob)) return "Pants";
  if (/\b(jacket|hoodie|jumper|vest|softshell)\b/.test(blob)) return "Jackets";
  if (/\b(apron|bib)\b/.test(blob)) return "Chef";
  if (/\b(ppe|mask|glove|gloves|safety|hi-?vis|reflect)\b/.test(blob)) return "PPE";
  if (/\b(scrub|scrubs)\b/.test(blob)) return "Scrubs";
  return "Miscellaneous";
}

function inferAudience(mainCategory) {
  const s = String(mainCategory ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "kids" || s === "kid" || s === "children" || s === "child") return "kids";
  if (s === "mens" || s === "men" || s === "male") return "mens";
  if (s === "womens" || s === "women" || s === "ladies" || s === "female") return "womens";
  if (s === "unisex") return "unisex";
  return null;
}

function uniq(list) {
  return [...new Set(list)];
}

/** Dedupe URLs while preserving first-seen order (Set spread keeps insertion order). */
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

/** Match API colour strings to sorted `colors[]` labels (spacing / case / unicode). */
function apColourNormKey(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/");
}

/** API examples use `colour`, but some integrations expose `color` or a small object. */
function variantColourLabel(v) {
  const raw = v?.colour ?? v?.color ?? v?.Colour ?? v?.Color;
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object") {
    const nested = raw.name ?? raw.label ?? raw.title ?? raw.colour ?? raw.color;
    return String(nested ?? "").trim();
  }
  return String(raw).trim();
}

function numberFromStockLevel(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

async function apiGetJson(path, token, query) {
  const url = new URL(API_BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return await res.json();
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
    const { error: upsErr } = await supabase.from("products").upsert(toUpsertById, { onConflict: "id" });
    if (upsErr) throw upsErr;
  }
}

function buildProductRow(apiProduct) {
  const name = String(apiProduct?.name ?? "").trim();
  const styleCode = String(apiProduct?.style_code ?? "").trim();
  const mainCategory = String(apiProduct?.main_category ?? "").trim();
  const subCategory = String(apiProduct?.sub_category ?? "").trim();
  const brand = String(apiProduct?.brand ?? "").trim();
  const descriptionHtml = apiProduct?.description ?? "";

  const variants = apiProduct?.variants?.data;
  const list = Array.isArray(variants) ? variants : [];
  const colors = uniq(list.map((v) => toTitleCase(variantColourLabel(v))).filter(Boolean)).sort((a, b) =>
    a.localeCompare(b),
  );
  const sizes = uniq(list.map((v) => String(v?.size ?? "").trim()).filter(Boolean)).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  const prices = list.map((v) => Number(v?.price)).filter((n) => Number.isFinite(n) && n > 0);
  const basePrice = prices.length ? Math.min(...prices) : null;

  const stockTotal = list.reduce((sum, v) => sum + numberFromStockLevel(v?.stock_level), 0);
  const stock_quantity = Math.max(0, Math.round(stockTotal));

  /**
   * `available_colors` is sorted alphabetically — `image_urls` must follow the same colour order so the
   * storefront can map chip index × stride to gallery URLs (front/back per variant).
   * - Match variant → colour with normalised keys (API spacing / case vs TitleCase list).
   * - Stable variant order per colour (numeric size) so front/back order is consistent.
   * - Dedupe URLs only *within* each colour (S/M variants often repeat the same image URLs — global dedupe
   *   would collapse front+back stride).
   */
  const orderedImageUrls = [];
  /** @type {Map<string, string[]>} */
  const urlsByColourNorm = new Map();
  for (const colour of colors) {
    const want = apColourNormKey(colour);
    if (!urlsByColourNorm.has(want)) {
      urlsByColourNorm.set(want, []);
    }
    const colourBucket = urlsByColourNorm.get(want);
    const variantsForColour = list
      .filter((v) => apColourNormKey(variantColourLabel(v)) === want)
      .sort((a, b) =>
        String(a?.size ?? "").localeCompare(String(b?.size ?? ""), undefined, { numeric: true }),
      );
    const seenThisColour = new Set();
    for (const v of variantsForColour) {
      const imgs = Array.isArray(v?.images?.data) ? v.images.data : [];
      for (const img of imgs) {
        const url = String(img?.filename ?? "").trim();
        if (!url.startsWith("http") || seenThisColour.has(url)) continue;
        seenThisColour.add(url);
        orderedImageUrls.push(url);
        colourBucket.push(url);
      }
    }
  }
  /**
   * When the colour-grouped pass yields nothing (missing/mismatched variant colour fields), the fallback
   * must not preserve raw API variant order — that order often follows catalogue entry order (e.g. White
   * first) while `available_colors` is sorted alphabetically (Black Navy, Slate, White), so chips ↔ gallery
   * look “rotated” (e.g. 1903L).
   */
  const variantsSortedForFallback = [...list].sort((a, b) => {
    const ca = apColourNormKey(variantColourLabel(a));
    const cb = apColourNormKey(variantColourLabel(b));
    if (ca !== cb) return ca.localeCompare(cb);
    return String(a?.size ?? "").localeCompare(String(b?.size ?? ""), undefined, { numeric: true });
  });
  const orderedWith2310Back =
    orderedImageUrls.length > 0
      ? maybeAppendAp2310BlackRedBackFallback(
          orderedImageUrls,
          urlsByColourNorm,
          colors,
          styleCode,
          getBossWebRoot(),
          { warn: (msg) => console.warn(msg) },
        )
      : orderedImageUrls;

  const imageUrls =
    orderedWith2310Back.length > 0
      ? orderedWith2310Back
      : dedupeOrderedHttpUrls(
          variantsSortedForFallback
            .flatMap((v) => (Array.isArray(v?.images?.data) ? v.images.data : []))
            .map((img) => String(img?.filename ?? "").trim())
            .filter((u) => u.startsWith("http")),
        );

  const category = inferDbCategory(mainCategory, subCategory, name);
  const audience = inferAudience(mainCategory);
  const slugBase = styleCode ? `ap-${slugify(styleCode)}` : `ap-${slugify(name)}`;
  const slug = slugBase || `ap-${Math.random().toString(16).slice(2)}`;

  const body = htmlToPlainText(descriptionHtml);
  const headerBits = [
    brand ? `Brand: ${toTitleCase(brand)}` : "",
    styleCode ? `Style code: ${styleCode}` : "",
    mainCategory ? `Main category: ${toTitleCase(mainCategory)}` : "",
    subCategory ? `Sub category: ${toTitleCase(subCategory)}` : "",
  ].filter(Boolean);
  const description = headerBits.length ? `${headerBits.join("\n")}\n\n${body}`.trim() : body;

  return {
    name: name || `${toTitleCase(brand) || "Aussie Pacific"} ${styleCode}`.trim(),
    slug,
    category,
    description,
    ...(basePrice != null ? { base_price: Math.round(basePrice * 100) / 100 } : {}),
    weight_kg: null,
    stock_quantity,
    image_urls: imageUrls,
    available_colors: colors.length ? colors : ["Black", "Navy", "Charcoal", "White", "Grey"],
    available_sizes: sizes,
    ...(audience ? { audience } : {}),
    is_active: apiProduct?.run_out ? false : true,
    supplier_name: "Aussie Pacific",
  };
}

async function main() {
  const args = parseArgs(process.argv);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiToken = process.env.AUSSIE_PACIFIC_API_TOKEN;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment (.env.local).");
    process.exit(1);
  }
  if (!apiToken) {
    console.error("Missing AUSSIE_PACIFIC_API_TOKEN in environment (.env.local).");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const columns = await getProductColumns(supabase);

  let page = 1;
  let totalPages = 1;
  let totalRows = 0;
  const BATCH = 40;

  while (page <= totalPages) {
    if (args.maxPages && page > args.maxPages) break;

    const json = await apiGetJson("/api/v1/products", apiToken, {
      include: "variants",
      page,
      limit: args.limit,
    });
    const data = Array.isArray(json?.data) ? json.data : [];
    const pagination = json?.meta?.pagination;
    const tp = Number(pagination?.total_pages);
    if (Number.isFinite(tp) && tp > 0) totalPages = tp;

    const rows = data.map(buildProductRow).map((r) => trimRow(r, columns));
    totalRows += rows.length;

    if (args.dryRun) {
      console.log(`[dry-run] page ${page}/${totalPages}: ${rows.length} products`);
    } else {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        await upsertProductsBatch(supabase, batch);
      }
      console.log(`Synced page ${page}/${totalPages}: ${rows.length} products`);
    }

    page += 1;
  }

  console.log(args.dryRun ? `Dry-run complete (${totalRows} rows scanned).` : `Sync complete (${totalRows} rows).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});


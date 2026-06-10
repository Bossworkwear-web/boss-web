/**
 * Scrape DNC Workwear product pages and update Supabase `products.description`.
 *
 * Usage:
 *   node scripts/scrape-dnc-descriptions.mjs --dry-run --limit=5
 *   node scripts/scrape-dnc-descriptions.mjs --style=3718
 *   node scripts/scrape-dnc-descriptions.mjs --from-cache
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";
import {
  fetchDncProductPage,
  parseDncProductPageHtml,
  styleCodeFromDncSlug,
} from "./lib/scrape-dnc-product-page.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUPPLIER_NAME = "DNC Workwear";
const CACHE_PATH = "data/supplier/dnc/scraped-product-details.json";
const DEFAULT_DELAY_MS = 300;

loadEnvLocal();

function parseArgs(argv) {
  const out = {
    dryRun: false,
    limit: Infinity,
    style: null,
    fromCache: false,
    delayMs: DEFAULT_DELAY_MS,
    visibleOnly: false,
    force: false,
  };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a === "--from-cache") {
      out.fromCache = true;
    } else if (a === "--visible-only") {
      out.visibleOnly = true;
    } else if (a === "--force") {
      out.force = true;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      out.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
    } else if (a.startsWith("--style=")) {
      out.style = a.slice("--style=".length).trim() || null;
    } else if (a.startsWith("--delay=")) {
      const n = Number(a.slice("--delay=".length));
      out.delayMs = Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_DELAY_MS;
    }
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Merge supplier body copy + feature tooltips into one DESCRIPTION field (no `features` DB column). */
function buildStorefrontDescription(parsed) {
  const body = String(parsed.description ?? "").trim();
  const features = String(parsed.features ?? "").trim();
  if (!features) {
    return body;
  }
  return `${body}\n\nFeatures:\n${features}`;
}

function loadCache(root) {
  const path = join(root, CACHE_PATH);
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(root, cache) {
  const path = join(root, CACHE_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

async function fetchAllDncProducts(supabase, { visibleOnly, style }) {
  const rows = [];
  const pageSize = 500;
  let from = 0;
  while (true) {
    let q = supabase
      .from("products")
      .select("id, slug, name, description, storefront_hidden")
      .eq("supplier_name", SUPPLIER_NAME)
      .order("slug", { ascending: true })
      .range(from, from + pageSize - 1);
    if (visibleOnly) {
      q = q.eq("storefront_hidden", false);
    }
    const { data, error } = await q;
    if (error) {
      throw new Error(error.message);
    }
    if (!data?.length) {
      break;
    }
    rows.push(...data);
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  if (style) {
    const slug = `dnc-${style.toLowerCase()}`;
    return rows.filter((r) => r.slug === slug || styleCodeFromDncSlug(r.slug) === style);
  }
  return rows;
}

async function scrapeWithRetry(styleCode, delayMs) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const html = await fetchDncProductPage(styleCode, {
        signal: AbortSignal.timeout(45_000),
      });
      const parsed = parseDncProductPageHtml(html, styleCode);
      if (!parsed?.description) {
        throw new Error("No description block parsed");
      }
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      return parsed;
    } catch (e) {
      lastErr = e;
      await sleep(800 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = getBossWebRoot();
  const cache = loadCache(root);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let products = await fetchAllDncProducts(supabase, {
    visibleOnly: args.visibleOnly,
    style: args.style,
  });
  products = products.slice(0, args.limit);

  const cacheHits = products.filter((p) => {
    const code = styleCodeFromDncSlug(p.slug);
    return code && cache[String(code).toLowerCase()]?.description;
  }).length;

  console.log(
    `DNC scrape: ${products.length} product(s), ${cacheHits} cached` +
      (args.force ? " [force re-scrape]" : "") +
      (args.dryRun ? " [dry-run]" : ""),
  );

  let scraped = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let cacheUsed = 0;

  for (const product of products) {
    const styleCode = styleCodeFromDncSlug(product.slug);
    if (!styleCode) {
      skipped += 1;
      continue;
    }

    let parsed = null;
    const cacheKey = styleCode.toLowerCase();
    const cached = cache[cacheKey]?.description ? cache[cacheKey] : null;
    if (!args.force && cache[cacheKey]?.failed) {
      skipped += 1;
      continue;
    }
    if (!args.force && cached) {
      parsed = cached;
      cacheUsed += 1;
    } else {
      try {
        parsed = await scrapeWithRetry(styleCode, cached ? 0 : args.delayMs);
        cache[cacheKey] = {
          ...parsed,
          scrapedAt: new Date().toISOString(),
        };
        scraped += 1;
        if (scraped % 10 === 0) {
          saveCache(root, cache);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        cache[cacheKey] = {
          failed: true,
          failedAt: new Date().toISOString(),
          error: message,
        };
        failed += 1;
        console.error(`\nFailed ${styleCode} (${product.slug}):`, message);
        continue;
      }
    }

    if (!parsed?.description) {
      skipped += 1;
      continue;
    }

    const nextDescription = buildStorefrontDescription(parsed);
    const unchanged = nextDescription === (product.description ?? "").trim();

    if (unchanged) {
      skipped += 1;
      continue;
    }

    if (args.dryRun) {
      console.log(`\n[dry-run] ${product.slug}`);
      console.log(nextDescription);
      updated += 1;
      continue;
    }

    const patch = { description: nextDescription };

    const { error } = await supabase.from("products").update(patch).eq("id", product.id);
    if (error) {
      failed += 1;
      console.error(`\nDB update failed ${product.slug}:`, error.message);
      continue;
    }
    updated += 1;
    if (updated % 25 === 0 || updated === products.length) {
      process.stdout.write(`\rUpdated ${updated}/${products.length} (scraped ${scraped}, failed ${failed})`);
    }
  }

  saveCache(root, cache);
  console.log(
    `\nDone. cacheUsed=${cacheUsed} scraped=${scraped} updated=${updated} skipped=${skipped} failed=${failed} cache=${CACHE_PATH}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

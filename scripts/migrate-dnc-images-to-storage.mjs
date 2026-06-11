/**
 * Mirror DNC hotlinked images into Supabase Storage and rewrite `products.image_urls`.
 *
 * Default source is DNC `productimages` (~40KB) not `hires` (~2–6MB) for faster PDP loads.
 * Storefront URLs become `/api/supplier-media/dnc/product/<file>` (same-origin proxy + CDN).
 *
 * Usage:
 *   node scripts/migrate-dnc-images-to-storage.mjs --dry-run
 *   node scripts/migrate-dnc-images-to-storage.mjs --limit=20
 *   node scripts/migrate-dnc-images-to-storage.mjs --source=hires
 *   node scripts/migrate-dnc-images-to-storage.mjs --only-failed
 *   node scripts/migrate-dnc-images-to-storage.mjs --visible-only
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      SUPPLIER_IMAGES_BUCKET (default: supplier-product-images)
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  dncDownloadUrlForSource,
  dncStorageObjectPath,
  dncSupplierMediaUrl,
  filenameFromDncUrl,
  isDncExternalImageUrl,
  isDncMigratedMediaUrl,
  mimeFromFilename,
  rewriteDncImageUrls,
} from "./lib/dnc-image-migration.mjs";
import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUPPLIER_NAME = "DNC Workwear";
const MAP_PATH = "data/supplier/dnc/image-migration-map.json";
const FAILED_PATH = "data/supplier/dnc/image-migration-failed.txt";
const DEFAULT_DELAY_MS = 200;
const DEFAULT_SOURCE = "product";

loadEnvLocal();

function parseArgs(argv) {
  const out = {
    dryRun: false,
    limit: Infinity,
    source: DEFAULT_SOURCE,
    delayMs: DEFAULT_DELAY_MS,
    visibleOnly: false,
    onlyFailed: false,
    skipUploaded: true,
    bucket: process.env.SUPPLIER_IMAGES_BUCKET ?? "supplier-product-images",
  };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a === "--visible-only") {
      out.visibleOnly = true;
    } else if (a === "--only-failed") {
      out.onlyFailed = true;
    } else if (a === "--force-download") {
      out.skipUploaded = false;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      out.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
    } else if (a.startsWith("--source=")) {
      const s = a.slice("--source=".length).trim().toLowerCase();
      out.source = s === "hires" ? "hires" : "product";
    } else if (a.startsWith("--delay=")) {
      const n = Number(a.slice("--delay=".length));
      out.delayMs = Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_DELAY_MS;
    } else if (a.startsWith("--bucket=")) {
      out.bucket = a.slice("--bucket=".length).trim() || out.bucket;
    }
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadMap(root) {
  const path = join(root, MAP_PATH);
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function saveMap(root, map) {
  const path = join(root, MAP_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(map, null, 2)}\n`, "utf8");
}

function loadFailedSet(root) {
  const path = join(root, FAILED_PATH);
  if (!existsSync(path)) {
    return new Set();
  }
  const out = new Set();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const key = line.split("\t")[0]?.trim();
    if (key) {
      out.add(key);
    }
  }
  return out;
}

function saveFailedList(root, failures) {
  const path = join(root, FAILED_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, failures.map((f) => `${f.key}\t${f.error}`).join("\n") + (failures.length ? "\n" : ""), "utf8");
}

async function fetchAllDncProducts(supabase, { visibleOnly }) {
  const rows = [];
  const pageSize = 500;
  let from = 0;
  while (true) {
    let q = supabase
      .from("products")
      .select("id, slug, image_urls, storefront_hidden")
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
  return rows;
}

function collectUniqueExternalUrls(products) {
  const urls = new Set();
  for (const p of products) {
    for (const u of p.image_urls ?? []) {
      if (isDncExternalImageUrl(u)) {
        urls.add(String(u).trim());
      }
    }
  }
  return [...urls];
}

async function downloadWithFallback(originalUrl, source) {
  const primary = dncDownloadUrlForSource(originalUrl, source);
  if (!primary) {
    throw new Error("Could not resolve download URL");
  }

  const attempts = [primary];
  if (source === "product") {
    const hires = dncDownloadUrlForSource(originalUrl, "hires");
    if (hires && hires !== primary) {
      attempts.push(hires);
    }
  }

  let lastErr = null;
  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "BossWorkwearCatalogSync/1.0 (+https://bossworkwear.au)",
          Accept: "image/*,*/*;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 128) {
        throw new Error(`Response too small (${buf.length} bytes)`);
      }
      const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || mimeFromFilename(url);
      return { buf, contentType, downloadedFrom: url };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function uploadWithRetry(supabase, bucket, objectPath, buf, contentType) {
  let lastMsg = "upload failed";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { error } = await supabase.storage.from(bucket).upload(objectPath, buf, {
      contentType,
      upsert: true,
      cacheControl: "31536000",
    });
    if (!error) {
      return;
    }
    lastMsg = error.message ?? lastMsg;
    await sleep(400 * 2 ** attempt);
  }
  throw new Error(lastMsg);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = getBossWebRoot();
  const mapObj = loadMap(root);
  const urlMap = new Map(Object.entries(mapObj).map(([src, v]) => [src, v.mediaUrl]));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const products = await fetchAllDncProducts(supabase, { visibleOnly: args.visibleOnly });
  let uniqueUrls = collectUniqueExternalUrls(products);

  if (args.onlyFailed) {
    const failed = loadFailedSet(root);
    uniqueUrls = uniqueUrls.filter((u) => failed.has(u));
  }

  uniqueUrls = uniqueUrls.slice(0, args.limit);

  console.log(
    `DNC image migration: ${uniqueUrls.length} unique external URL(s), source=${args.source}, bucket=${args.bucket}` +
      (args.visibleOnly ? ", visible products only" : "") +
      (args.dryRun ? " [dry-run]" : ""),
  );

  if (args.dryRun) {
    console.log("Sample URLs:");
    for (const u of uniqueUrls.slice(0, 5)) {
      const name = filenameFromDncUrl(u);
      const objectPath = dncStorageObjectPath(name, args.source);
      console.log(`  ${u}`);
      console.log(`    → download ${dncDownloadUrlForSource(u, args.source)}`);
      console.log(`    → ${dncSupplierMediaUrl(objectPath)}`);
    }
    const needDb = products.filter((p) => rewriteDncImageUrls(p.image_urls, urlMap));
    console.log(`Products already on media paths: ${products.filter((p) => (p.image_urls ?? []).every((u) => !isDncExternalImageUrl(u))).length}`);
    console.log(`Products pending DB rewrite (after upload): ${needDb.length}`);
    return;
  }

  const failures = [];
  let uploaded = 0;
  let skipped = 0;

  for (let i = 0; i < uniqueUrls.length; i += 1) {
    const originalUrl = uniqueUrls[i];
    const existing = mapObj[originalUrl];
    if (existing?.mediaUrl && args.skipUploaded) {
      urlMap.set(originalUrl, existing.mediaUrl);
      skipped += 1;
      continue;
    }

    const filename = filenameFromDncUrl(originalUrl);
    const objectPath = dncStorageObjectPath(filename, args.source);
    if (!objectPath) {
      failures.push({ key: originalUrl, error: "Could not derive storage path" });
      continue;
    }

    try {
      const { buf, contentType, downloadedFrom } = await downloadWithFallback(originalUrl, args.source);
      await uploadWithRetry(supabase, args.bucket, objectPath, buf, contentType);
      const mediaUrl = dncSupplierMediaUrl(objectPath);
      mapObj[originalUrl] = {
        mediaUrl,
        objectPath,
        source: args.source,
        downloadedFrom,
        bytes: buf.length,
        migratedAt: new Date().toISOString(),
      };
      urlMap.set(originalUrl, mediaUrl);
      uploaded += 1;
      if (uploaded % 25 === 0) {
        saveMap(root, mapObj);
      }
      if (args.delayMs > 0) {
        await sleep(args.delayMs);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      failures.push({ key: originalUrl, error: message });
      console.error(`\nFailed ${filename}: ${message}`);
    }

    if ((i + 1) % 25 === 0 || i + 1 === uniqueUrls.length) {
      process.stdout.write(`\rImages ${i + 1}/${uniqueUrls.length} (uploaded ${uploaded}, skipped ${skipped}, failed ${failures.length})`);
    }
  }

  saveMap(root, mapObj);
  saveFailedList(root, failures);
  console.log(`\nUpload phase done. uploaded=${uploaded} skipped=${skipped} failed=${failures.length}`);

  const toPatch = [];
  for (const product of products) {
    const nextUrls = rewriteDncImageUrls(product.image_urls, urlMap);
    if (nextUrls) {
      toPatch.push({ id: product.id, slug: product.slug, image_urls: nextUrls });
    }
  }

  console.log(`Rewriting image_urls on ${toPatch.length} product row(s)…`);
  let updated = 0;
  for (let i = 0; i < toPatch.length; i += 1) {
    const row = toPatch[i];
    const { error } = await supabase.from("products").update({ image_urls: row.image_urls }).eq("id", row.id);
    if (error) {
      console.error(`DB update failed ${row.slug}:`, error.message);
      process.exit(1);
    }
    updated += 1;
    if (updated % 50 === 0 || updated === toPatch.length) {
      process.stdout.write(`\rUpdated products ${updated}/${toPatch.length}`);
    }
  }

  console.log(`\nDone. map=${MAP_PATH} failures=${failures.length ? FAILED_PATH : "none"}`);
  if (failures.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

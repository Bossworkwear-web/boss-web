/**
 * Upload data/supplier/<supplier>/images/** to Supabase Storage bucket `supplier-product-images`
 * (run supabase/migrations/20260401_supplier_product_images_bucket.sql first).
 *
 * After upload, point product URLs at storage:
 *   npm run sync:supplier -- --supplier=YOUR --images=storage
 * or:
 *   npm run upload:supplier-images -- --supplier=YOUR --rewrite-products
 *
 * Usage:
 *   npm run upload:supplier-images -- --supplier=fashion-biz --dry-run
 *   npm run upload:supplier-images -- --supplier=fashion-biz
 *   npm run upload:supplier-images -- --supplier=fashion-biz --rewrite-products
 *
 * Retry only paths from the last failure report (no full tree scan under images/):
 *   npm run upload:supplier-images -- --supplier=fashion-biz --only-failed
 *   npm run upload:supplier-images -- --supplier=fashion-biz --only-failed --failed-file=/path/to/list.txt
 *
 * On failures: continues (does not stop at first error), retries transient "fetch failed" errors,
 * then writes `upload-supplier-images-failed-<supplier>.txt` at repo root. Re-run the command to retry.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      SUPPLIER_IMAGES_BUCKET (default: supplier-product-images)
 */
import { createClient } from "@supabase/supabase-js";
import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

loadEnvLocal();

function parseArgs(argv) {
  const out = {
    supplier: null,
    dryRun: false,
    rewriteProducts: false,
    onlyFailed: false,
    failedFile: null,
    limit: Infinity,
    bucket: process.env.SUPPLIER_IMAGES_BUCKET ?? "supplier-product-images",
  };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a === "--rewrite-products") {
      out.rewriteProducts = true;
    } else if (a === "--only-failed") {
      out.onlyFailed = true;
    } else if (a.startsWith("--failed-file=")) {
      out.failedFile = a.split("=")[1]?.trim() || null;
    } else if (a.startsWith("--supplier=")) {
      out.supplier = a.split("=")[1]?.trim() || null;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.split("=")[1]);
      out.limit = Number.isFinite(n) && n > 0 ? n : Infinity;
    } else if (a.startsWith("--bucket=")) {
      out.bucket = a.split("=")[1]?.trim() || out.bucket;
    }
  }
  return out;
}

function loadImagesSubdir(supplier) {
  const root = getBossWebRoot();
  const path = join(root, "data", "supplier", supplier, "catalog.config.json");
  if (!existsSync(path)) {
    return "images";
  }
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    return String(j.imagesSubdir ?? "images").replace(/^\/+|\/+$/g, "");
  } catch {
    return "images";
  }
}

/**
 * Parse `upload-supplier-images-failed-<supplier>.txt` lines (`objectPath<TAB>error`) into upload rows.
 * Does **not** walk `images/` recursively — only checks `existsSync` for each path from the report.
 */
function sliceFromFailedReport(reportPath, imagesRoot, supplier, imagesSubdir) {
  const text = readFileSync(reportPath, "utf8");
  const prefix = `${supplier}/${imagesSubdir}/`;
  const seen = new Set();
  const rows = [];
  let blankOrComment = 0;
  let wrongPrefix = 0;
  let duplicate = 0;
  let missingLocal = 0;
  for (const line of text.split("\n")) {
    const objectPath = (line.split("\t")[0] ?? "").trim().replace(/\/+/g, "/");
    if (!objectPath || objectPath.startsWith("#")) {
      blankOrComment += 1;
      continue;
    }
    if (!objectPath.startsWith(prefix)) {
      wrongPrefix += 1;
      console.warn("[only-failed] skip (expected prefix " + prefix + "):", objectPath);
      continue;
    }
    if (seen.has(objectPath)) {
      duplicate += 1;
      continue;
    }
    seen.add(objectPath);
    const rel = objectPath.slice(prefix.length);
    const parts = rel.split("/").filter(Boolean);
    const full = join(imagesRoot, ...parts);
    if (!existsSync(full)) {
      missingLocal += 1;
      console.warn("[only-failed] missing local file:", full);
      continue;
    }
    rows.push({
      full,
      rel: rel.replace(/\\/g, "/"),
      objectPath,
    });
  }
  console.log(
    `[only-failed] no full scan: ${rows.length} file(s) to upload (missing on disk=${missingLocal}, wrong-prefix=${wrongPrefix}, duplicates=${duplicate}, blank/comments=${blankOrComment})`,
  );
  return rows;
}

function collectFiles(dir, base, out) {
  for (const ent of readdirSync(dir)) {
    if (ent.startsWith(".") || ent === ".DS_Store") {
      continue;
    }
    const p = join(dir, ent);
    const st = statSync(p);
    if (st.isDirectory()) {
      collectFiles(p, base, out);
    } else if (IMG_EXT.has(extname(ent).toLowerCase())) {
      out.push({ full: p, rel: relative(base, p).split("\\").join("/") });
    }
  }
}

function mimeFor(ext) {
  const e = ext.toLowerCase();
  if (e === ".jpg" || e === ".jpeg") {
    return "image/jpeg";
  }
  if (e === ".png") {
    return "image/png";
  }
  if (e === ".webp") {
    return "image/webp";
  }
  if (e === ".gif") {
    return "image/gif";
  }
  return "application/octet-stream";
}

async function bufferStream(stream) {
  const chunks = [];
  for await (const c of stream) {
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Transient errors from undici / Supabase — worth retrying before giving up on one file. */
function isRetryableUploadErrorMessage(msg) {
  const m = String(msg ?? "").toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("econnreset") ||
    m.includes("socket") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("504") ||
    m.includes("429") ||
    m.includes("rate") ||
    m.includes("econnrefused")
  );
}

/**
 * @returns {Promise<string | null>} error message or null on success
 */
async function uploadOneFileWithRetries(supabase, bucket, f, maxAttempts) {
  let lastMsg = "";
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const stream = createReadStream(f.full);
      const buf = await bufferStream(stream);
      const { error } = await supabase.storage.from(bucket).upload(f.objectPath, buf, {
        contentType: mimeFor(extname(f.full)),
        upsert: true,
      });
      if (!error) {
        return null;
      }
      lastMsg = error.message ?? "unknown error";
      if (!isRetryableUploadErrorMessage(lastMsg) || attempt === maxAttempts - 1) {
        break;
      }
    } catch (e) {
      lastMsg = e instanceof Error ? e.message : String(e);
      if (!isRetryableUploadErrorMessage(lastMsg) || attempt === maxAttempts - 1) {
        break;
      }
    }
    await delay(400 * 2 ** attempt);
  }
  return lastMsg || "upload failed";
}

function publicUrl(supabaseUrl, bucket, objectPath) {
  const base = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}`;
  const enc = objectPath
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${base}/${enc}`;
}

function rewriteImageUrl(url, supplier, supabaseUrl, bucket) {
  const prefix = `/api/supplier-media/${supplier}/`;
  if (typeof url !== "string" || !url.startsWith(prefix)) {
    return url;
  }
  const rest = url.slice(prefix.length);
  return publicUrl(supabaseUrl, bucket, `${supplier}/${rest}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.supplier) {
    console.error(
      "Usage: node scripts/upload-supplier-images.mjs --supplier=fashion-biz [--dry-run] [--rewrite-products] [--only-failed] [--failed-file=PATH]",
    );
    process.exit(1);
  }

  const supplier = args.supplier.replace(/^\/+|\/+$/g, "");
  const imagesSubdir = loadImagesSubdir(supplier);
  const root = getBossWebRoot();
  const imagesRoot = join(root, "data", "supplier", supplier, imagesSubdir);

  if (!existsSync(imagesRoot)) {
    console.error("Missing:", imagesRoot);
    process.exit(1);
  }

  let slice;
  if (args.onlyFailed) {
    const reportPath = args.failedFile ?? join(root, `upload-supplier-images-failed-${supplier}.txt`);
    if (!existsSync(reportPath)) {
      console.error("Missing failure report:", reportPath);
      console.error("Run a full upload once (or pass --failed-file= with one object path per line).");
      process.exit(1);
    }
    const fromReport = sliceFromFailedReport(reportPath, imagesRoot, supplier, imagesSubdir);
    slice = fromReport.slice(0, args.limit);
    console.log(`[only-failed] report=${reportPath} bucket=${args.bucket} (uploading ${slice.length}${args.limit < Infinity ? `, limit=${args.limit}` : ""})`);
  } else {
    const files = [];
    collectFiles(imagesRoot, imagesRoot, files);
    slice = files.slice(0, args.limit).map((f) => ({
      ...f,
      objectPath: `${supplier}/${imagesSubdir}/${f.rel.replace(/\\/g, "/")}`.replace(/\/+/g, "/"),
    }));
    const total = files.length;
    const uploading = slice.length;
    console.log(
      `Files: ${uploading < total ? `${uploading} of ${total} (limit)` : total} (uploading ${uploading}) → bucket ${args.bucket}`,
    );
  }

  if (args.dryRun) {
    console.log("Sample keys:", slice.slice(0, 3).map((s) => s.objectPath));
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const failures = [];
  let ok = 0;
  const maxAttempts = 4;
  for (let i = 0; i < slice.length; i += 1) {
    const f = slice[i];
    const errMsg = await uploadOneFileWithRetries(supabase, args.bucket, f, maxAttempts);
    if (errMsg) {
      failures.push(`${f.objectPath}\t${errMsg}`);
      console.error(`\nUpload failed (${i + 1}/${slice.length}):`, f.objectPath, errMsg);
    } else {
      ok += 1;
    }
    if ((i + 1) % 25 === 0 || i + 1 === slice.length) {
      process.stdout.write(`\rUploaded ${ok}/${slice.length} (${failures.length} failed)`);
    }
  }
  console.log(`\nUpload finished. OK=${ok}, failed=${failures.length}, total=${slice.length}.`);
  if (failures.length > 0) {
    const reportPath = join(root, `upload-supplier-images-failed-${supplier}.txt`);
    writeFileSync(reportPath, `${failures.join("\n")}\n`, "utf8");
    console.error(`Failed object paths (with errors) → ${reportPath}`);
    console.error("Re-run the same command to retry; transient errors often succeed on a second pass.");
    process.exitCode = 1;
  }

  if (!args.rewriteProducts) {
    return;
  }

  const prefix = `/api/supplier-media/${supplier}/`;
  const pageSize = 500;
  let page = 0;
  const toPatch = [];

  for (;;) {
    const { data: rows, error: selErr } = await supabase
      .from("products")
      .select("id, image_urls")
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (selErr) {
      console.error("Could not load products for rewrite:", selErr.message);
      process.exit(1);
    }
    if (!rows?.length) {
      break;
    }

    for (const row of rows) {
      const urls = row.image_urls;
      if (!Array.isArray(urls) || !urls.some((u) => typeof u === "string" && u.startsWith(prefix))) {
        continue;
      }
      const nextUrls = urls.map((u) => rewriteImageUrl(u, supplier, supabaseUrl, args.bucket));
      toPatch.push({ id: row.id, image_urls: nextUrls });
    }

    if (rows.length < pageSize) {
      break;
    }
    page += 1;
  }

  console.log(`Rewriting image_urls on ${toPatch.length} product row(s)…`);

  for (let i = 0; i < toPatch.length; i += 1) {
    const row = toPatch[i];
    const { error: upErr } = await supabase
      .from("products")
      .update({ image_urls: row.image_urls })
      .eq("id", row.id);
    if (upErr) {
      console.error("Rewrite failed:", row.id, upErr.message);
      process.exit(1);
    }
    if ((i + 1) % 50 === 0 || i + 1 === toPatch.length) {
      process.stdout.write(`\rRewrote ${i + 1}/${toPatch.length}`);
    }
  }
  console.log("\nRewrite complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

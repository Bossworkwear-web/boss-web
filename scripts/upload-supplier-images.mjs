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
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      SUPPLIER_IMAGES_BUCKET (default: supplier-product-images)
 */
import { createClient } from "@supabase/supabase-js";
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
    limit: Infinity,
    bucket: process.env.SUPPLIER_IMAGES_BUCKET ?? "supplier-product-images",
  };
  for (const a of argv) {
    if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a === "--rewrite-products") {
      out.rewriteProducts = true;
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
      "Usage: node scripts/upload-supplier-images.mjs --supplier=fashion-biz [--dry-run] [--rewrite-products]",
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

  const files = [];
  collectFiles(imagesRoot, imagesRoot, files);
  const slice = files.slice(0, args.limit).map((f) => ({
    ...f,
    objectPath: `${supplier}/${imagesSubdir}/${f.rel.replace(/\\/g, "/")}`.replace(/\/+/g, "/"),
  }));

  console.log(`Files: ${files.length} (uploading ${slice.length}) → bucket ${args.bucket}`);

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

  let ok = 0;
  for (const f of slice) {
    const stream = createReadStream(f.full);
    const buf = await bufferStream(stream);
    const { error } = await supabase.storage.from(args.bucket).upload(f.objectPath, buf, {
      contentType: mimeFor(extname(f.full)),
      upsert: true,
    });
    if (error) {
      console.error("Upload failed:", f.objectPath, error.message);
      process.exit(1);
    }
    ok += 1;
    if (ok % 25 === 0 || ok === slice.length) {
      process.stdout.write(`\rUploaded ${ok}/${slice.length}`);
    }
  }
  console.log("\nUpload complete.");

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

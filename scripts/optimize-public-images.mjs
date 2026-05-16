#!/usr/bin/env node
/**
 * Compress raster images under public/ for production (in-place).
 * Uses sharp when available; falls back to macOS `sips` on darwin.
 *
 * Usage: node scripts/optimize-public-images.mjs [--dry-run] [--min-kb=80]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const dryRun = process.argv.includes("--dry-run");
const minKb = Number((process.argv.find((a) => a.startsWith("--min-kb=")) ?? "--min-kb=80").split("=")[1]) || 80;

const RASTER = new Set([".jpg", ".jpeg", ".png"]);

function maxWidthFor(relPath) {
  const base = path.basename(relPath).toLowerCase();
  const rel = relPath.replace(/\\/g, "/").toLowerCase();
  if (rel.startsWith("mock_up/")) return 1200;
  if (base.startsWith("hero_")) return 1920;
  if (base.startsWith("ad_")) return 1400;
  if (base.startsWith("service_") || base === "rush_option.png") return 1600;
  if (rel.includes("special-deals") || base.includes("package")) return 900;
  if (base.includes("favicon")) return 512;
  if (base.includes("logo") || base.includes("bossww") || base.includes("supplier_logo")) return 1200;
  return 1600;
}

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      await walk(abs, out);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (RASTER.has(ext)) {
        out.push(abs);
      }
    }
  }
  return out;
}

let sharpModule = null;
async function getSharp() {
  if (sharpModule !== null) return sharpModule;
  try {
    const mod = await import("sharp");
    sharpModule = mod.default;
    return sharpModule;
  } catch {
    sharpModule = false;
    return false;
  }
}

async function optimizeWithSips(absPath, maxWidth) {
  const ext = path.extname(absPath).toLowerCase();
  const tmp = `${absPath}.opt-tmp${ext}`;
  const args = ["-Z", String(maxWidth), absPath, "--out", tmp];
  const res = spawnSync("/usr/bin/sips", args, { encoding: "utf8" });
  if (res.status !== 0) {
    await fs.unlink(tmp).catch(() => undefined);
    throw new Error(res.stderr?.trim() || "sips failed");
  }
  return tmp;
}

/** Paths that must not be re-encoded in-place (sips/jpeg can destroy quality on logos). */
function shouldSkip(relPath) {
  const base = path.basename(relPath).toLowerCase();
  if (base.includes("supplier_logo")) return true;
  if (base.includes("bossww_logo")) return true;
  return false;
}

async function optimizeFile(absPath) {
  const stat = await fs.stat(absPath);
  if (stat.size < minKb * 1024) {
    return { skipped: true };
  }

  const rel = path.relative(root, absPath);
  if (shouldSkip(rel)) {
    return { skipped: true };
  }
  const maxWidth = maxWidthFor(rel);
  const sharp = await getSharp();

  let outBuf;
  if (sharp) {
    const ext = path.extname(absPath).toLowerCase();
    const input = sharp(absPath, { failOn: "none" });
    const meta = await input.metadata();
    const pipeline = input.rotate().resize({
      width: meta.width && meta.width > maxWidth ? maxWidth : undefined,
      withoutEnlargement: true,
      fit: "inside",
    });
    if (ext === ".png") {
      outBuf = await pipeline.png({ compressionLevel: 9, effort: 10 }).toBuffer();
    } else {
      outBuf = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    }
  } else if (process.platform === "darwin") {
    const tmp = await optimizeWithSips(absPath, maxWidth);
    outBuf = await fs.readFile(tmp);
    await fs.unlink(tmp);
  } else {
    return { skipped: true, reason: "no sharp/sips" };
  }

  const before = stat.size;
  const after = outBuf.length;
  if (after >= before * 0.98) {
    return { skipped: true };
  }

  if (!dryRun) {
    await fs.writeFile(absPath, outBuf);
  }

  return { skipped: false, before, after, rel };
}

async function main() {
  const sharp = await getSharp();
  const backend = sharp ? "sharp" : process.platform === "darwin" ? "sips" : "none";
  if (backend === "none") {
    console.error("Install sharp (npm install) or run on macOS with sips.");
    process.exit(1);
  }

  const files = await walk(root);
  let saved = 0;
  let processed = 0;

  console.log(
    `${dryRun ? "[dry-run] " : ""}Optimizing ${files.length} images via ${backend} (min ${minKb}KB)…`,
  );

  for (const abs of files.sort()) {
    try {
      const res = await optimizeFile(abs);
      if (res.skipped) continue;
      processed += 1;
      saved += res.before - res.after;
      const pct = ((1 - res.after / res.before) * 100).toFixed(0);
      console.log(`  ${res.rel}: ${(res.before / 1024).toFixed(0)}KB → ${(res.after / 1024).toFixed(0)}KB (-${pct}%)`);
    } catch (e) {
      console.warn(`  skip ${path.relative(root, abs)}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(
    `\nDone. ${processed} file(s) ${dryRun ? "would be " : ""}optimized; ~${(saved / 1024 / 1024).toFixed(2)} MB saved.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

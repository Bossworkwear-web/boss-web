import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const generatedDir = path.join(rootDir, "app", "generated");
const generatedFilePath = path.join(generatedDir, "logo.ts");

const BOSSWW_LOGO_PNG = "Bossww_Logo.png";
const LEGACY_LOGO = "logo.png";

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Match `Bossww_Logo.jpg` case-insensitively but emit the real filename (Linux URLs are case-sensitive). */
function pickBosswwJpegName(files) {
  return files.find((n) => {
    const lower = n.toLowerCase();
    return lower === "bossww_logo.jpg" || lower === "bossww_logo.jpeg";
  });
}

async function main() {
  const publicFiles = await fs.readdir(publicDir);

  const bosswwJpegName = pickBosswwJpegName(publicFiles);
  const bosswwPng = path.join(publicDir, BOSSWW_LOGO_PNG);
  const legacyPath = path.join(publicDir, LEGACY_LOGO);

  let urlPath;
  if (bosswwJpegName) {
    urlPath = `/${bosswwJpegName}`;
  } else if (await fileExists(bosswwPng)) {
    urlPath = `/${BOSSWW_LOGO_PNG}`;
    console.warn(
      `Bossww_Logo jpg not found — using ${BOSSWW_LOGO_PNG}. Prefer public/Bossww_Logo.jpg (any letter case).`,
    );
  } else if (await fileExists(legacyPath)) {
    urlPath = `/${LEGACY_LOGO}`;
    console.warn(
      `Bossww_Logo jpg not found — using ${LEGACY_LOGO}. Add public/Bossww_Logo.jpg for the Boss WW logo.`,
    );
  } else {
    console.error(
      `Missing logo: add public/Bossww_Logo.jpg (or ${BOSSWW_LOGO_PNG} / ${LEGACY_LOGO} as fallback).`,
    );
    process.exit(1);
  }

  await Promise.all(
    publicFiles
      .filter((name) => /^logo-[a-f0-9]{8}\.png$/i.test(name))
      .map((name) => fs.unlink(path.join(publicDir, name)).catch(() => {})),
  );

  await fs.mkdir(generatedDir, { recursive: true });
  await fs.writeFile(
    generatedFilePath,
    `export const LOGO_SRC = "${urlPath}";\n`,
    "utf8",
  );

  console.log(`LOGO_SRC → ${urlPath}`);
}

main().catch((error) => {
  console.error("Failed to configure storefront logo.", error);
  process.exit(1);
});

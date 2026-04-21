import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const generatedDir = path.join(rootDir, "app", "generated");
const generatedFilePath = path.join(generatedDir, "logo.ts");

const BOSSWW_LOGO = "Bossww_Logo.jpg";
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

async function main() {
  const bosswwJpg = path.join(publicDir, BOSSWW_LOGO);
  const bosswwPng = path.join(publicDir, BOSSWW_LOGO_PNG);
  const legacyPath = path.join(publicDir, LEGACY_LOGO);

  let urlPath;
  if (await fileExists(bosswwJpg)) {
    urlPath = `/${BOSSWW_LOGO}`;
  } else if (await fileExists(bosswwPng)) {
    urlPath = `/${BOSSWW_LOGO_PNG}`;
    console.warn(
      `public/${BOSSWW_LOGO} not found — using ${BOSSWW_LOGO_PNG}. Prefer public/${BOSSWW_LOGO}.`,
    );
  } else if (await fileExists(legacyPath)) {
    urlPath = `/${LEGACY_LOGO}`;
    console.warn(
      `public/${BOSSWW_LOGO} not found — using ${LEGACY_LOGO}. Add public/${BOSSWW_LOGO} for the Boss WW logo.`,
    );
  } else {
    console.error(
      `Missing logo: add public/${BOSSWW_LOGO} (or ${BOSSWW_LOGO_PNG} / ${LEGACY_LOGO} as fallback).`,
    );
    process.exit(1);
  }

  const publicFiles = await fs.readdir(publicDir);
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

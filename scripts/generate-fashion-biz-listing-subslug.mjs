/**
 * style_code → storefront sub slug from Biz Care / Biz Collection CSVs (category + title text).
 * Fixes folder-based DB "T-shirts" for pants/jackets when product name is only "Biz Care SKU".
 *
 * Run: node scripts/generate-fashion-biz-listing-subslug.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getBossWebRoot } from "./lib/load-env.mjs";

const SUB_ORDER = [
  "pants",
  "jackets",
  "miscellaneous",
  "head-wear",
  "chef",
  "scrubs",
  "boots",
  "glove",
  "safty-glasses",
  "hi-vis-vest",
  "work-shirts",
  "polos",
  "shirts",
  "t-shirts",
];

function mergeSubSlug(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  if (a === b) return a;
  const ia = SUB_ORDER.indexOf(a);
  const ib = SUB_ORDER.indexOf(b);
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ia <= ib ? a : b;
}

function splitCsvFields(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * @param {string} blob category + style title / description (lowercase ok)
 * @returns {string | null}
 */
function classifyFashionBizListingBlob(blob) {
  const b = blob.toLowerCase();

  if (/scrub pant|scrub pants|;\s*scrub pant/.test(b)) {
    return "pants";
  }
  if (
    /;\s*pants\s*;/.test(b) ||
    /\bbottoms\b[^.;]{0,80}\bpants\b/.test(b) ||
    /\bfunctional pant\b|\bstretch pant\b|3\/4 length|\bskort\b|jogger scrub|straight leg scrub/.test(b) ||
    /\bwalk short\b|\bgolf short\b/.test(b)
  ) {
    return "pants";
  }
  if (/;\s*shorts\s*;/.test(b) && /bottoms|functional|stretch|early learning|pharmaceutical/.test(b)) {
    return "pants";
  }

  if ((/scrub top|scrub tops|scrub identifier|avery scrub/i.test(b) && !/scrub pant/.test(b)) || /\bscrubs\b.*\btops\b/.test(b)) {
    return "scrubs";
  }

  if (/;socks;|;\s*bags\b|tote bag|;\s*hijab\b|^unisex happy feet comfort socks/.test(b)) {
    return "miscellaneous";
  }
  if (/\bhijab\b|head scarf/.test(b)) {
    return "head-wear";
  }

  if (/\bapron\b|bib apron|waist apron|waisted apron/.test(b) && !/caban/i.test(b)) {
    return "chef";
  }

  if (
    /\bjacket\b|outerwear|softshell|hardshell|anorak|\bparka\b|windbreaker|bomber|puffer|quilted|rain jacket/.test(b)
  ) {
    return "jackets";
  }
  if (/knitwear|cardigan|knit vest|;\s*vests\s*;/.test(b) && /\b(vest|cardigan|knit)\b/.test(b)) {
    return "jackets";
  }
  if (/\bfleece\b/.test(b) && /\b(jacket|vest|pullover|hood)\b/.test(b)) {
    return "jackets";
  }

  if (/\bpolo\b/.test(b) && !/polo neck/i.test(b)) {
    return "polos";
  }

  if (/work shirt|workshirt|overall|coverall/.test(b)) {
    return "work-shirts";
  }

  if (
    /\bt-?shirt\b|\btee\b|\bt-?tops?\b|;\s*tees\s*;|jersey top|underscrub|underscrubs|\bjersey\b.*\btop\b/.test(b) ||
    /long sleeve tee|short sleeve tee/.test(b)
  ) {
    return "t-shirts";
  }

  if (/;shirts;|shirting|tunic|\bblouse\b|short sleeve shirt|long sleeve shirt|3\/4 sleeve shirt|sleeve shirt/.test(b)) {
    return "shirts";
  }

  return null;
}

function detectRow(cols, headerLower) {
  if (headerLower[0] === "sku" && headerLower[1] === "style_code") {
    const code = cols[1]?.trim();
    if (!code) return null;
    const blob = `${cols[2] ?? ""} ${cols[3] ?? ""}`;
    return { code, blob };
  }
  if (headerLower[0] === "style" && headerLower[1] === "colors") {
    const code = cols[0]?.trim();
    if (!code) return null;
    const blob = `${cols[3] ?? ""} ${cols[4] ?? ""}`;
    return { code, blob };
  }
  return null;
}

function main() {
  /** @type {Map<string, string | null>} */
  const map = new Map();
  const root = getBossWebRoot();
  const csvDir = join(root, "data", "supplier", "fashion-biz", "csv");
  if (!existsSync(csvDir)) {
    console.warn("No CSV dir:", csvDir);
    writeFileSync(
      join(root, "lib", "fashion-biz-listing-subslug.generated.ts"),
      `/* eslint-disable */\n// Auto-generated — empty (no CSV dir).\n\nexport const FASHION_BIZ_LISTING_SUBSLUG: Record<string, string> = {};\n`,
      "utf8",
    );
    return;
  }

  const files = readdirSync(csvDir).filter(
    (f) =>
      f.toLowerCase().endsWith(".csv") &&
      (f.toLowerCase().includes("biz-care") || f.toLowerCase().includes("biz-collection")),
  );

  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(csvDir, file), "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    if (!lines.length) continue;
    const headerCols = splitCsvFields(lines[0]).map((c) => c.trim());
    const headerLower = headerCols.map((c) => c.toLowerCase());

    for (let li = 1; li < lines.length; li += 1) {
      const line = lines[li];
      if (!line.trim()) continue;
      const cols = splitCsvFields(line);
      const row = detectRow(cols, headerLower);
      if (!row) continue;
      const key = row.code.toUpperCase();
      const sub = classifyFashionBizListingBlob(row.blob);
      if (sub == null) continue;
      map.set(key, mergeSubSlug(map.get(key) ?? null, sub));
    }
  }

  const outPath = join(root, "lib", "fashion-biz-listing-subslug.generated.ts");
  const linesOut = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);

  const body = `/* eslint-disable */
// Auto-generated by scripts/generate-fashion-biz-listing-subslug.mjs — do not edit.

export const FASHION_BIZ_LISTING_SUBSLUG: Record<string, string> = {
${linesOut.join("\n")}
};
`;
  writeFileSync(outPath, body, "utf8");
  console.log(`Wrote ${map.size} style codes → ${outPath}`);
}

main();

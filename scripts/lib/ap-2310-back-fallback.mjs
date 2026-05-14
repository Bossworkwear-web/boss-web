/**
 * Aussie Pacific style `2310`: API sometimes omits a Black/Red back image while other combo colours
 * have front+back. Append a same-origin catalogue URL that resolves via `app/api/supplier-media`
 * (Storage first, then repo file `data/supplier/Aussie Pacific/2310_back.webp`).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

export const AP_2310_BACK_MEDIA_URL = "/api/supplier-media/aussie-pacific/2310_back.webp";

export const AP_2310_BACK_REPO_SEGMENTS = ["data", "supplier", "Aussie Pacific", "2310_back.webp"];

/** 0-based: back image is the 8th slot — after the first seven catalogue images. */
export const AP_2310_BACK_INSERT_INDEX = 7;

function isAp2310BackUrl(u) {
  const s = String(u).toLowerCase();
  return s.includes("2310_back.webp") && s.includes("aussie-pacific");
}

export function normalizeApColourKey(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/");
}

/**
 * @param {string[]} orderedImageUrls flat list from colour-major build (sync order)
 * @param {Map<string, string[]>} urlsByNorm normalized colour key → URLs for that colour
 * @param {string[]} colors TitleCase colour labels (same order as sync loop)
 * @param {string} styleCode API `style_code`
 * @param {string} bossWebRepoRoot absolute path to `boss-web` root
 * @param {{ warn?: (msg: string) => void }} [opts]
 * @returns {string[]}
 */
export function maybeAppendAp2310BlackRedBackFallback(
  orderedImageUrls,
  urlsByNorm,
  colors,
  styleCode,
  bossWebRepoRoot,
  opts = {},
) {
  const sc = String(styleCode ?? "").trim();
  if (!/^2310$/i.test(sc)) {
    return orderedImageUrls;
  }
  if (!Array.isArray(colors) || colors.length !== 3 || !Array.isArray(orderedImageUrls)) {
    return orderedImageUrls;
  }
  const combo = new Set(["black/green", "black/orange", "black/red"]);
  const norms = colors.map((c) => normalizeApColourKey(c));
  if (norms.some((k) => !combo.has(k))) {
    return orderedImageUrls;
  }
  const redKey = "black/red";
  const red = urlsByNorm.get(redKey) ?? [];
  let maxOther = 0;
  for (const [k, arr] of urlsByNorm) {
    if (k === redKey) continue;
    maxOther = Math.max(maxOther, arr.length);
  }
  // Others have at least front+back; Red has a front but fewer URLs → missing back.
  if (maxOther < 2 || red.length < 1 || red.length >= maxOther) {
    return orderedImageUrls;
  }

  const localPath = join(bossWebRepoRoot, ...AP_2310_BACK_REPO_SEGMENTS);
  if (!existsSync(localPath)) {
    opts.warn?.(
      `[sync-aussie-pacific] Style 2310: Black/Red has ${red.length} image(s) but other colours have up to ${maxOther}; ` +
        `add ${AP_2310_BACK_REPO_SEGMENTS.join("/")} to insert ${AP_2310_BACK_MEDIA_URL} after image 7.`,
    );
    return orderedImageUrls;
  }

  const base = orderedImageUrls.filter((u) => !isAp2310BackUrl(u));
  if (base.length >= AP_2310_BACK_INSERT_INDEX) {
    return [...base.slice(0, AP_2310_BACK_INSERT_INDEX), AP_2310_BACK_MEDIA_URL, ...base.slice(AP_2310_BACK_INSERT_INDEX)];
  }
  return [...base, AP_2310_BACK_MEDIA_URL];
}

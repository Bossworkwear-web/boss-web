/** Fragment on first gallery URL from `sync-aussie-pacific-api.mjs` — per-colour image counts (sorted `available_colors`). */
export const AP_GALLERY_COLOR_COUNTS_HASH_RE = /#apcc=([\d,]+)$/i;

export function stripApGalleryColorCountsHash(url: string): { url: string; counts: number[] | null } {
  const s = typeof url === "string" ? url : "";
  const m = AP_GALLERY_COLOR_COUNTS_HASH_RE.exec(s);
  if (!m?.[1]) {
    return { url: s, counts: null };
  }
  const counts = m[1]
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return {
    url: s.slice(0, m.index),
    counts: counts.length > 0 ? counts : null,
  };
}

export function appendApGalleryColorCountsHash(firstUrl: string, counts: readonly number[]): string {
  const base = stripApGalleryColorCountsHash(String(firstUrl ?? "")).url.trim();
  if (!base || !counts.length) {
    return base;
  }
  const payload = counts.map((n) => Math.max(0, Math.floor(n))).join(",");
  return `${base}#apcc=${payload}`;
}

/** Hero gallery index for colour chip `colorIdx` when images are grouped by colour in sync order. */
export function apHeroIndexForColor(colorIdx: number, counts: readonly number[]): number | null {
  if (colorIdx < 0 || colorIdx >= counts.length) {
    return null;
  }
  let cursor = 0;
  for (let i = 0; i < colorIdx; i++) {
    cursor += Math.max(0, counts[i] ?? 0);
  }
  const n = Math.max(0, counts[colorIdx] ?? 0);
  if (n <= 0) {
    return null;
  }
  return cursor;
}

/** Which colour chip owns gallery image `imageIdx` under grouped sync order. */
export function apColorIndexForGalleryImage(imageIdx: number, counts: readonly number[]): number {
  if (imageIdx < 0 || !counts.length) {
    return 0;
  }
  let cursor = 0;
  for (let ci = 0; ci < counts.length; ci++) {
    const n = Math.max(0, counts[ci] ?? 0);
    if (n <= 0) {
      continue;
    }
    if (imageIdx < cursor + n) {
      return ci;
    }
    cursor += n;
  }
  return Math.max(0, counts.length - 1);
}

export function apColorImageCountsAlignWithColors(
  counts: readonly number[] | null | undefined,
  colorCount: number,
): counts is readonly number[] {
  return Array.isArray(counts) && counts.length === colorCount && counts.some((n) => n > 0);
}

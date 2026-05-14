/**
 * Aussie Pacific style `2211` PDP: remove standalone Black / Navy chips and drop gallery images that map
 * to those colours (opaque URLs — use the same proportional bucket index as `opaqueColorIndexForGalleryImage`).
 */

export function isStorefrontAp2211Slug(slug: string | null | undefined): boolean {
  const s = String(slug ?? "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  if (/(?:^|-)ap-2211(?:$|-)/.test(s)) return true;
  if (s.startsWith("ap-") && /(?:^|[-_])2211(?:$|[-_])/.test(s)) return true;
  return false;
}

function isHiddenStandaloneBlackOrNavyLabel(label: string): boolean {
  const t = String(label).trim().toLowerCase();
  return t === "black" || t === "navy";
}

/** Remove `Black` / `Navy` chips only (not combos like `Black/Red`). */
export function filterAp2211ColorOptions(colors: readonly string[]): string[] {
  return colors.filter((c) => !isHiddenStandaloneBlackOrNavyLabel(String(c)));
}

/**
 * `colorsSortedFull` must match API sync order (alphabetical). Each gallery index is assigned a colour bucket
 * via `floor(j * n / m)` — same as storefront opaque gallery ↔ chip sync.
 */
export function filterAp2211ImageUrls(urls: readonly string[], colorsSortedFull: readonly string[]): string[] {
  const m = urls.length;
  const n = colorsSortedFull.length;
  if (m === 0 || n <= 0) {
    return [...urls];
  }
  const out: string[] = [];
  for (let j = 0; j < m; j++) {
    const ci = Math.min(n - 1, Math.max(0, Math.floor((j * n) / m)));
    const label = String(colorsSortedFull[ci] ?? "");
    if (isHiddenStandaloneBlackOrNavyLabel(label)) {
      continue;
    }
    out.push(String(urls[j]));
  }
  return out;
}

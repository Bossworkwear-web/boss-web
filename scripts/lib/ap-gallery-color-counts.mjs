/** Keep in sync with `lib/ap-gallery-color-counts.ts`. */
export const AP_GALLERY_COLOR_COUNTS_HASH_RE = /#apcc=([\d,]+)$/i;

export function stripApGalleryColorCountsHash(url) {
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

export function appendApGalleryColorCountsHash(firstUrl, counts) {
  const base = stripApGalleryColorCountsHash(String(firstUrl ?? "")).url.trim();
  if (!base || !counts.length) {
    return base;
  }
  const payload = counts.map((n) => Math.max(0, Math.floor(n))).join(",");
  return `${base}#apcc=${payload}`;
}

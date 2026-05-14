/** Same-origin URL written by `sync-aussie-pacific-api.mjs` for the local Black/Red back asset. */
export const AP_2310_BACK_MEDIA_URL = "/api/supplier-media/aussie-pacific/2310_back.webp";

/**
 * Black/Red back is the **8th** gallery slot (1-based): insert at 0-based index 7, after the first seven
 * API images (PDP chip heroes stay at 3 / 5 / 7).
 */
export const AP_2310_BACK_INSERT_INDEX = 7;

export function isStorefrontAp2310Slug(slug: string | null | undefined): boolean {
  const s = String(slug ?? "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  if (/(?:^|-)ap-2310(?:$|-)/.test(s)) return true;
  if (s.startsWith("ap-") && /(?:^|[-_])2310(?:$|[-_])/.test(s)) return true;
  return false;
}

export function urlLooksLikeAp2310BackAsset(u: string): boolean {
  const s = String(u).toLowerCase();
  return s.includes("2310_back.webp") && s.includes("aussie-pacific");
}

/**
 * Move/remove duplicate `2310_back` URLs so a single canonical entry sits at index 7 (after seven images).
 */
export function repositionAp2310BlackRedBackAfterSeventh(urls: readonly string[]): string[] {
  const list = urls.map(String);
  const base = list.filter((u) => !urlLooksLikeAp2310BackAsset(u));
  const hadBack = base.length !== list.length;
  if (!hadBack) {
    return list;
  }
  if (base.length >= AP_2310_BACK_INSERT_INDEX) {
    return [...base.slice(0, AP_2310_BACK_INSERT_INDEX), AP_2310_BACK_MEDIA_URL, ...base.slice(AP_2310_BACK_INSERT_INDEX)];
  }
  return [...base, AP_2310_BACK_MEDIA_URL];
}

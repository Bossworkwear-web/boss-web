/**
 * Aussie Pacific style `2111` (Tasman polo): gallery uses `#apcc=` from sync — standalone `BLACK` / `NAVY`
 * have one front image each; combo colours have two (front + back). See `resolveApPdpGalleryState`.
 */

export function isStorefrontAp2111Slug(slug: string | null | undefined): boolean {
  const s = String(slug ?? "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  if (/(?:^|-)ap-2111(?:$|-)/.test(s)) return true;
  if (s.startsWith("ap-") && /(?:^|[-_])2111(?:$|[-_])/.test(s)) return true;
  return false;
}

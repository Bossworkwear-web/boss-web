/**
 * Aussie Pacific style `3309` PDP: hide `Navy/White/Ash` chip only (no image list changes — gallery URLs stay as synced).
 */

export function isStorefrontAp3309Slug(slug: string | null | undefined): boolean {
  const s = String(slug ?? "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  if (/(?:^|-)ap-3309(?:$|-)/.test(s)) return true;
  if (s.startsWith("ap-") && /(?:^|[-_])3309(?:$|[-_])/.test(s)) return true;
  return false;
}

function compactAp3309ColourKey(label: string): string {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\/+/g, "/");
}

function isExcludedNavyWhiteAshLabel(label: string): boolean {
  return compactAp3309ColourKey(label) === "navy/white/ash";
}

export function filterAp3309ColorOptions(colors: readonly string[]): string[] {
  return colors.filter((c) => !isExcludedNavyWhiteAshLabel(String(c)));
}

/**
 * Aussie Pacific style `2211` PDP: hide standalone `BLACK` (no usable product shot in sync) and drop
 * its gallery block so `#apcc=` stays aligned with visible chips. Standalone `NAVY` stays visible (1 image);
 * combo colours use two (front + back).
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

/** Standalone `BLACK` / `Black` only — not `Black/Red`, etc. */
export function isHiddenStandaloneAp2211BlackLabel(label: string): boolean {
  const t = String(label).trim().toLowerCase().replace(/\s+/g, "");
  return t === "black";
}

export function filterAp2211ColorOptions(colors: readonly string[]): string[] {
  return colors.filter((c) => !isHiddenStandaloneAp2211BlackLabel(String(c)));
}

/**
 * When storefront rules hide `BLACK`, rebuild the pre-filter sorted colour list so sync `#apcc=` can be
 * trimmed (first bucket) in parallel with gallery URLs.
 */
export function ap2211ColorsSortedFullForGalleryCounts(
  colorOptions: readonly string[],
  apColorImageCounts: readonly number[] | null | undefined,
): readonly string[] {
  const sorted = [...colorOptions].sort((a, b) => String(a).localeCompare(String(b)));
  if (!apColorImageCounts?.length || sorted.length === apColorImageCounts.length) {
    return sorted;
  }
  if (sorted.length + 1 !== apColorImageCounts.length) {
    return sorted;
  }
  if (sorted.some((c) => isHiddenStandaloneAp2211BlackLabel(String(c)))) {
    return sorted;
  }
  return ["BLACK", ...sorted.map(String)];
}

/**
 * Remove the hidden `BLACK` image block from the gallery and drop its `#apcc` count so chip index ↔ URLs
 * match `filterAp2211ColorOptions` (incl. standalone `NAVY` with one front image).
 */
export function applyAp2211GalleryAdjustments(
  imageUrls: readonly string[],
  apColorImageCounts: readonly number[] | null | undefined,
  colorOptionsEffective: readonly string[],
): { imageUrls: string[]; apColorImageCounts: number[] | null } {
  const urls = imageUrls.map(String);
  if (!apColorImageCounts?.length) {
    return { imageUrls: urls, apColorImageCounts: apColorImageCounts?.length ? [...apColorImageCounts] : null };
  }

  const sortedFull = ap2211ColorsSortedFullForGalleryCounts(colorOptionsEffective, apColorImageCounts);
  if (!isHiddenStandaloneAp2211BlackLabel(String(sortedFull[0] ?? ""))) {
    return { imageUrls: urls, apColorImageCounts: [...apColorImageCounts] };
  }

  const blackImages = Math.max(0, apColorImageCounts[0] ?? 0);
  const trimmedUrls = blackImages > 0 ? urls.slice(blackImages) : urls;
  const trimmedCounts = apColorImageCounts.slice(1);
  return {
    imageUrls: trimmedUrls,
    apColorImageCounts: trimmedCounts.length > 0 ? [...trimmedCounts] : null,
  };
}

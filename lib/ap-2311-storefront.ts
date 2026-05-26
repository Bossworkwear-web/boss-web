/**
 * Aussie Pacific style `2311` PDP: hide standalone `NAVY` chip (no product image in API sync).
 * Combo chips like `Navy/gold` stay visible.
 */

export function isStorefrontAp2311Slug(slug: string | null | undefined): boolean {
  const s = String(slug ?? "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  if (/(?:^|-)ap-2311(?:$|-)/.test(s)) return true;
  if (s.startsWith("ap-") && /(?:^|[-_])2311(?:$|[-_])/.test(s)) return true;
  return false;
}

/** Standalone `NAVY` / `Navy` only — not `Navy/gold`, `Navy/white`, etc. */
export function isHiddenStandaloneAp2311NavyLabel(label: string): boolean {
  const t = String(label).trim().toLowerCase().replace(/\s+/g, "");
  return t === "navy";
}

export function filterAp2311ColorOptions(colors: readonly string[]): string[] {
  return colors.filter((c) => !isHiddenStandaloneAp2311NavyLabel(String(c)));
}

/**
 * When storefront rules hide `NAVY`, rebuild the pre-filter sorted colour list so `#apcc=` counts
 * (still aligned to full API sync order) can be filtered in parallel.
 */
export function ap2311ColorsSortedFullForGalleryCounts(
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
  if (sorted.some((c) => isHiddenStandaloneAp2311NavyLabel(String(c)))) {
    return sorted;
  }
  const out: string[] = [];
  let inserted = false;
  for (const c of sorted) {
    if (!inserted && String(c).localeCompare("NAVY") > 0) {
      out.push("NAVY");
      inserted = true;
    }
    out.push(String(c));
  }
  if (!inserted) {
    out.push("NAVY");
  }
  return out;
}

/** Drop the `NAVY` bucket from `#apcc=` so chip index ↔ gallery blocks stay aligned. */
export function filterAp2311ColorImageCounts(
  colorsSortedFull: readonly string[],
  counts: readonly number[] | null | undefined,
): number[] | null {
  if (!Array.isArray(counts) || counts.length !== colorsSortedFull.length) {
    return counts?.length ? [...counts] : null;
  }
  const out: number[] = [];
  for (let i = 0; i < colorsSortedFull.length; i++) {
    if (isHiddenStandaloneAp2311NavyLabel(String(colorsSortedFull[i] ?? ""))) {
      continue;
    }
    out.push(counts[i] ?? 0);
  }
  return out.length > 0 ? out : null;
}

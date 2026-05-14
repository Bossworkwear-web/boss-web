/**
 * Fashion Biz catalog products use display names `Biz Care {STYLE}` / `Biz Collection {STYLE}`
 * and slugs `…-bizcare-{style}` / `…-bizcollection-{style}` (brand segment has no hyphens).
 *
 * Yes Chef hospitality uses `Yes Chef BA55 …`, `Yes Chef / BA55`, and slugs like `…-yeschef-ba55-…`.
 */
export function fashionBizStyleCodeFromListing(name: string, storeSlug?: string | null): string | null {
  const trimmed = name.trim();
  /** Word-boundary match: names may include `-CLEARANCE` / multi-part style codes after the style code. */
  let m = /\bBiz Care\s+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\b/i.exec(trimmed);
  if (m) {
    return m[1].toUpperCase();
  }
  m = /\bBiz Collection\s+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\b/i.exec(trimmed);
  if (m) {
    return m[1].toUpperCase();
  }
  /** `Yes Chef BA55`, `Yes Chef / BA55`, optional hyphenated suffixes e.g. BA75-CLEARANCE */
  m = /\bYes\s*Chef\s*(?:\/\s*)?([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\b/i.exec(trimmed);
  if (m) {
    return m[1].toUpperCase();
  }
  const s = (storeSlug ?? "").trim().toLowerCase();
  if (!s) {
    return null;
  }
  const parts = s.split(/[-_]+/).filter(Boolean);
  for (const brandSeg of ["bizcare", "bizcollection", "yeschef"]) {
    const idx = parts.findIndex((p) => p === brandSeg);
    if (idx >= 0 && parts[idx + 1]) {
      const sku = parts[idx + 1].toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (parts[idx + 2]?.toUpperCase() === "CLEARANCE") {
        return `${sku}-CLEARANCE`;
      }
      return sku;
    }
  }
  return null;
}

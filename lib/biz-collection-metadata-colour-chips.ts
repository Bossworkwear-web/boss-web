/**
 * Fashion Biz / Biz Collection sync sometimes emits non-garment colour rows (detail imagery, multi layouts, group shots).
 */

/** True for chips like `Group` (mix-and-match metadata — not a purchasable garment colour). */
export function isBizCollectionGroupMetadataColourChip(label: string): boolean {
  return String(label).trim().toLowerCase() === "group";
}

/** Style bases that strip `Group` metadata chips on the PDP (see {@link isBizCollectionGroupMetadataColourChip}). */
export const BIZ_COLLECTION_GROUP_METADATA_STYLE_BASES = new Set<string>(["S421ML", "S421LL"]);

/** True for chips like `Detail` or `Detail / Multi` (metadata — not a purchasable garment colour). */
export function isBizCollectionDetailMetadataColourChip(label: string): boolean {
  const t = String(label)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (t === "detail") {
    return true;
  }
  return /^detail\s*\/\s*multi$/.test(t);
}

/** Style bases that strip Detail / Detail-Multi metadata chips on the PDP. */
export const BIZ_COLLECTION_DETAIL_METADATA_STYLE_BASES = new Set<string>([
  "WP10310",
  "BS724M",
  "BS724L",
  "LB8200",
  "CH248L",
]);

/**
 * Biz Care `CID940U`: sync may list `Teal/01` without real product imagery — hide that chip on the PDP.
 * Normalizes spaces so `Teal / 01` matches.
 */
export function isBizCareCid940uExcludedColourChip(label: string): boolean {
  const t = String(label)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  return t === "teal/01";
}

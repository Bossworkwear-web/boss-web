/** Compact colour key for storefront chip ↔ filename matching. */
export function compactColorKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Normalize supplier colour labels / filename tokens before matching.
 * Keeps navy on hi-vis Yellow/Orange/Pink + Navy combos so keys align with
 * filenames like `C91 FYN` → yellownavy and `C91 ORANGE NAVY` → orangenavy.
 */
export function normalizeSupplierColorSynonyms(label: string): string {
  let s = label.replace(/\s+/g, " ").trim();
  // Blue Whale / generic: ignore marketing qualifiers when matching filenames.
  s = s.replace(/\bSafety\b/gi, "").replace(/\bFluoro\b/gi, "").replace(/\s+/g, " ").trim();
  s = s.replace(/\bnavy\s*blue\b/gi, "navy");
  // Some supplier-media filenames split "navy blue" into separate tokens; treat lone "blue" as part of navy.
  if (/\bnavy\b/i.test(s)) {
    s = s.replace(/\bblue\b/gi, "").replace(/\s+/g, " ").trim();
  }
  s = s.replace(/\byello\b/gi, "yellow");
  // Blue Whale image tokens like `FYN` / `FON` appear in filenames; map them to the labelled combos.
  s = s.replace(/\bfyn\b/gi, "yellow navy");
  s = s.replace(/\bfon\b/gi, "orange navy");
  s = s.replace(/\bfybt\b/gi, "yellow bottle green");
  // Bisley Apex / taped combos sometimes use TT01/TT02 tokens in filenames.
  s = s.replace(/\btt01\b/gi, "yellow / navy");
  s = s.replace(/\btt02\b/gi, "orange / navy");
  // Some Bisley media uses TT04 for the Yellow/Navy combo (e.g. BJ6730T).
  s = s.replace(/\btt04\b/gi, "yellow / navy");
  // Some Bisley media uses TT05 for the Orange/Navy combo (e.g. BJ6934T).
  s = s.replace(/\btt05\b/gi, "orange / navy");
  // Some Bisley media uses TT21 for the Pink/Navy combo (e.g. BKL6975).
  s = s.replace(/\btt21\b/gi, "pink / navy");
  // Blue Whale: strip style codes so `C91 ORANGE NAVY` / mis-linked C82/C83 media normalize to colour only.
  s = s.replace(/\bc91\b/gi, "");
  s = s.replace(/\bc82\b/gi, "");
  s = s.replace(/\bc83\b/gi, "");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\bBlack\s+P\s+Grey\b/gi, "Black / Grey");
  if (s.includes("/")) {
    const parts = s
      .split(/\s*\/\s*/)
      .map((seg) => seg.trim())
      .filter(Boolean)
      .map((seg) => seg.replace(/\bnavy\b/gi, "navy").trim());
    const keys = parts.map((p) => compactColorKey(p));
    // Keep navy on hi-vis Yellow/Orange/Pink + Navy combos so keys match filenames
    // (`C91 FYN` → yellownavy, `C91 ORANGE NAVY` → orangenavy) instead of collapsing to
    // bare `yellow` / `orange` (which wrongly prefer `BACK VENT ORANGE` shots).
    const keepNavyForHivis =
      keys.some((k) => k === "navy") &&
      keys.some((k) => k === "yellow" || k === "orange" || k === "pink");
    const kept = parts
      .filter((p) => keepNavyForHivis || compactColorKey(p) !== "navy")
      .map((p) => {
        if (/^p\s*grey$/i.test(p) || compactColorKey(p) === "pgrey") {
          return "Grey";
        }
        return p;
      });
    return (kept.length > 0 ? kept : parts).join(" / ");
  }
  return s;
}

export function colorMatchKey(label: string): string {
  return compactColorKey(normalizeSupplierColorSynonyms(label));
}

/**
 * True when a chip label key and a filename-derived key refer to the same colour.
 * Handles Yellow ↔ Yellow/Navy and Orange ↔ Orange/Navy after synonym normalization.
 */
export function colorMatchKeysCompatible(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  for (const tone of ["yellow", "orange", "pink"] as const) {
    const withNavy = `${tone}navy`;
    if ((a === tone || a === withNavy) && (b === tone || b === withNavy)) {
      return true;
    }
  }
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) {
    return true;
  }
  return false;
}

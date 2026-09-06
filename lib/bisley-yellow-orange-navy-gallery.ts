/**
 * Align Bisley Yellow/Orange (often /Navy) colour chips with gallery heroes.
 * Filename tokens: TT01/TT04 = Yellow, TT02/TT05 = Orange (Bisley Apex / taped).
 * Critical for order accuracy — chip label must match the garment shown.
 */

export type BisleyYellowOrangeKind = "yellow" | "orange";

function galleryFilenameUpper(url: string): string {
  const tail = String(url).split("/").pop() ?? String(url);
  let file = tail;
  try {
    file = decodeURIComponent(tail);
  } catch {
    file = tail;
  }
  return (file.split("?")[0] ?? file).toUpperCase();
}

/** Classify a Bisley gallery URL as yellow or orange colourway. */
export function bisleyYellowOrangeKindFromImageUrl(url: string): BisleyYellowOrangeKind | null {
  const up = galleryFilenameUpper(url);
  // Prefer explicit colour words when present (overrides TT when both appear).
  // Underscores are word chars — do not use `\bORANGE\b` / `\bYELLOW\b`.
  const hasOrangeWord = /(?:^|[^A-Z0-9])ORANGE(?:[^A-Z0-9]|$)/.test(up);
  const hasYellowWord = /(?:^|[^A-Z0-9])YELLOW(?:[^A-Z0-9]|$)/.test(up);
  if (hasOrangeWord && !hasYellowWord) return "orange";
  if (hasYellowWord && !hasOrangeWord) return "yellow";

  // Apex / taped colourway codes — filenames use `_TT04_1.jpg`.
  if (/(?:^|[^A-Z0-9])TT(?:02|05)(?:[^A-Z0-9]|$)/.test(up)) return "orange";
  if (/(?:^|[^A-Z0-9])TT(?:01|04)(?:[^A-Z0-9]|$)/.test(up)) return "yellow";

  // FR / taped Bisley colour codes.
  if (/(?:^|[^A-Z0-9])(?:BF61|BVEO|ORNV|NVOR)(?:[^A-Z0-9]|$)/.test(up)) return "orange";
  if (/(?:^|[^A-Z0-9])(?:BF51|BBLY|YLNV|NVYL)(?:[^A-Z0-9]|$)/.test(up)) return "yellow";

  return null;
}

export function bisleyYellowOrangeKindFromColorLabel(label: string): BisleyYellowOrangeKind | null {
  const s = String(label ?? "").toLowerCase();
  const hasOrange = /\borange\b/.test(s);
  const hasYellow = /\byellow\b/.test(s);
  if (hasOrange && !hasYellow) return "orange";
  if (hasYellow && !hasOrange) return "yellow";
  return null;
}

export function isBisleyYellowOrangeNavyPair(colors: readonly string[]): boolean {
  if (colors.length !== 2) return false;
  // Exclude unrelated combos like Navy/Orange + Black/Yellow (BP6412T uses TT05 differently).
  if (colors.some((c) => /\bblack\b/i.test(String(c)))) return false;
  const kinds = colors.map(bisleyYellowOrangeKindFromColorLabel);
  return kinds.includes("yellow") && kinds.includes("orange");
}

/**
 * Reorder gallery so the first Yellow and Orange heroes match `colors` chip order.
 * Returns a new array; unchanged if classification is incomplete.
 */
export function alignBisleyYellowOrangeGalleryToColorChips(
  colors: readonly string[],
  imageUrls: readonly string[],
): string[] {
  if (!isBisleyYellowOrangeNavyPair(colors) || imageUrls.length < 2) {
    return [...imageUrls];
  }

  const chip0 = bisleyYellowOrangeKindFromColorLabel(colors[0] ?? "");
  const chip1 = bisleyYellowOrangeKindFromColorLabel(colors[1] ?? "");
  if (!chip0 || !chip1 || chip0 === chip1) {
    return [...imageUrls];
  }

  const byKind = new Map<BisleyYellowOrangeKind, string>();
  for (const u of imageUrls) {
    const k = bisleyYellowOrangeKindFromImageUrl(u);
    if (k && !byKind.has(k)) {
      byKind.set(k, u);
    }
  }
  const first = byKind.get(chip0);
  const second = byKind.get(chip1);
  if (!first || !second) {
    return [...imageUrls];
  }

  const used = new Set([first, second]);
  const rest = imageUrls.filter((u) => !used.has(u));
  return [first, second, ...rest];
}

export type BisleyYellowOrangeMismatch = {
  chipOrder: BisleyYellowOrangeKind[];
  imageOrder: Array<BisleyYellowOrangeKind | null>;
  mismatched: boolean;
};

/** Detect chip↔hero mismatch for audit scripts. */
export function detectBisleyYellowOrangeChipImageMismatch(
  colors: readonly string[],
  imageUrls: readonly string[],
): BisleyYellowOrangeMismatch | null {
  if (!isBisleyYellowOrangeNavyPair(colors) || imageUrls.length < 2) {
    return null;
  }
  const chipOrder = colors
    .map(bisleyYellowOrangeKindFromColorLabel)
    .filter((k): k is BisleyYellowOrangeKind => k != null);
  if (chipOrder.length !== 2) return null;

  const heroes: Array<BisleyYellowOrangeKind | null> = [];
  const seen = new Set<BisleyYellowOrangeKind>();
  for (const u of imageUrls) {
    const k = bisleyYellowOrangeKindFromImageUrl(u);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    heroes.push(k);
    if (heroes.length === 2) break;
  }
  while (heroes.length < 2) heroes.push(null);

  const mismatched =
    heroes[0] != null &&
    heroes[1] != null &&
    (heroes[0] !== chipOrder[0] || heroes[1] !== chipOrder[1]);

  return { chipOrder, imageOrder: heroes, mismatched };
}

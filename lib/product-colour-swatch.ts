/**
 * Map storefront PDP colour labels to display swatches (hex fills).
 * Combo labels use " / " (e.g. "Grey / Lime") — one swatch per segment.
 */

export type ProductColourSwatchPart = {
  label: string;
  hex: string;
};

export type ProductColourSwatchContext = {
  productSlug?: string | null;
};

/** Longest keys first so "royal blue" wins over "blue". */
const COLOUR_HEX_ENTRIES = ([
  ["fluoro yellow lime", "#c6f000"],
  ["fluoro yellow", "#e8ff00"],
  ["hi-vis orange", "#ff6600"],
  ["hi vis orange", "#ff6600"],
  ["hi-vis yellow", "#e8ff00"],
  ["hi vis yellow", "#e8ff00"],
  ["hi-vis green", "#39ff14"],
  ["hi vis green", "#39ff14"],
  ["hi-vis pink", "#ff69b4"],
  ["hi vis pink", "#ff69b4"],
  ["hi-vis", "#e8ff00"],
  ["fluoro lime", "#c6f000"],
  ["fluoro green", "#39ff14"],
  ["fluoro orange", "#ff6600"],
  ["fluoro pink", "#ff69b4"],
  ["fluoro", "#e8ff00"],
  ["neon green", "#83ff6d"],
  ["neon pink", "#ff384d"],
  ["royal blue", "#2563eb"],
  ["sky blue", "#87ceeb"],
  ["ceil blue", "#8fd6e8"],
  ["light blue", "#93c5fd"],
  ["dark blue", "#1e3a5f"],
  ["dark navy", "#0f172a"],
  ["navy blue", "#1e3a5f"],
  ["light grey", "#d1d5db"],
  ["light gray", "#d1d5db"],
  ["dark grey", "#4b5563"],
  ["dark gray", "#4b5563"],
  ["mid grey", "#9ca3af"],
  ["mid gray", "#9ca3af"],
  ["p grey", "#6b7280"],
  ["pgrey", "#6b7280"],
  ["charcoal", "#36454f"],
  ["bottle green", "#0a391b"],
  ["burgundy", "#800020"],
  ["maroon", "#7f1d1d"],
  ["forest green", "#228b22"],
  ["forest", "#228b22"],
  ["pea green", "#6b8e23"],
  ["olive green", "#6b8e23"],
  ["mint green", "#98fb98"],
  ["lime green", "#84cc16"],
  ["royal", "#2563eb"],
  ["stone", "#928e85"],
  ["sand", "#c2b280"],
  ["khaki", "#c3b091"],
  ["mustard", "#d4a017"],
  ["natural", "#e8dcc8"],
  ["ecru", "#f5f0e6"],
  ["cream", "#fffdd0"],
  ["pearl", "#f0eae2"],
  ["coral", "#ff7f50"],
  ["magenta", "#d946ef"],
  ["fuchsia", "#d946ef"],
  ["violet", "#7c3aed"],
  ["purple", "#7c3aed"],
  ["indigo", "#4f46e5"],
  ["teal", "#0d9488"],
  ["aqua", "#22d3ee"],
  ["cyan", "#06b6d4"],
  ["denim", "#1d4ed8"],
  ["orange", "#f97316"],
  ["yellow", "#eab308"],
  ["silver", "#a8a29e"],
  ["bronze", "#a16207"],
  ["brown", "#92400e"],
  ["beige", "#d6c4a8"],
  ["wine", "#722f37"],
  ["pink", "#f472b6"],
  ["red", "#dc2626"],
  ["crimson", "#b91c1c"],
  ["green", "#16a34a"],
  ["lime", "#84cc16"],
  ["olive", "#6b8e23"],
  ["blue", "#3b82f6"],
  ["navy", "#1e3a5f"],
  ["slate", "#525252"],
  ["ashe", "#525252"],
  ["ash", "#525252"],
  ["gold", "#ffb831"],
  ["bottle", "#0a391b"],
  ["grey", "#6b7280"],
  ["gray", "#6b7280"],
  ["black", "#171717"],
  ["white", "#ffffff"],
  ["check", "#525252"],
] satisfies [string, string][]).sort((a, b) => b[0].length - a[0].length);

function normalizeColourPart(raw: string): string {
  return raw
    .trim()
    .replace(/^product\s+/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function hashColourFallback(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (Math.imul(31, h) + label.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 42% 42%)`;
}

export function productColourPartToHex(part: string, _context?: ProductColourSwatchContext): string {
  const normalized = normalizeColourPart(part);
  if (!normalized) {
    return hashColourFallback(part);
  }

  for (const [key, hex] of COLOUR_HEX_ENTRIES) {
    if (normalized === key) {
      return hex;
    }
  }

  for (const [key, hex] of COLOUR_HEX_ENTRIES) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(normalized)) {
      return hex;
    }
  }

  return hashColourFallback(normalized);
}

/** Split combo labels: "Grey / Lime", "Black/Gold", "Navy-Sky-Silver" (underscore combos from filenames). */
export function parseProductColourParts(label: string): string[] {
  const trimmed = label.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.includes("/")) {
    return trimmed
      .split(/\s*\/\s*/g)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  if (trimmed.includes(" / ")) {
    return trimmed
      .split(/\s+\/\s+/g)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  if (/[_-]/.test(trimmed) && !/\s/.test(trimmed)) {
    const words = trimmed.split(/[_-]+/g).map((p) => p.trim()).filter(Boolean);
    if (words.length >= 2 && words.every((w) => /^[a-z]+$/i.test(w))) {
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }
  }

  return [trimmed];
}

export function productColourLabelToSwatches(
  label: string,
  context?: ProductColourSwatchContext,
): ProductColourSwatchPart[] {
  const parts = parseProductColourParts(label);
  if (parts.length === 0) {
    return [{ label: label.trim() || "—", hex: hashColourFallback(label) }];
  }
  return parts.map((part) => ({
    label: part,
    hex: productColourPartToHex(part, context),
  }));
}

/** True only for white swatches (needs a grey edge on white PDP background). */
export function productColourSwatchIsWhite(part: { label: string; hex: string }): boolean {
  if (normalizeColourPart(part.label) === "white") {
    return true;
  }
  const h = part.hex.trim().toLowerCase();
  return h === "#fff" || h === "#ffffff";
}

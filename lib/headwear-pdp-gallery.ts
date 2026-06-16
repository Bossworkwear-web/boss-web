/**
 * Headwear (Xada / BigCommerce) PDP gallery: variant filenames ↔ colour chips.
 * Patterns: `4199_Black.jpg`, `4199aus-brown.jpg`, `3975-black.jpg`, `4143-green-stone.jpg`.
 */

function compactColorKey(input: string): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function titleCaseWord(w: string): string {
  const t = w.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function isHeadwearStorefrontProduct(
  slug?: string | null,
  supplierName?: string | null,
  category?: string | null,
): boolean {
  const sup = String(supplierName ?? "").trim().toLowerCase();
  if (sup === "headwear" || sup === "head wear") {
    return true;
  }
  const cat = String(category ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (cat === "head wear" || cat === "headwear") {
    return true;
  }
  return String(slug ?? "").trim().toLowerCase().startsWith("hw-");
}

/** Style digits from slug `hw-4199` → `4199`. */
export function headwearStyleCodeFromSlug(slug?: string | null): string | null {
  const m = String(slug ?? "")
    .trim()
    .toLowerCase()
    .match(/^hw-([a-z0-9][a-z0-9-]*)$/i);
  return m?.[1] ? m[1].toUpperCase() : null;
}

export function headwearFilenameTail(url: string): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  try {
    const path = raw.includes("://") ? new URL(raw).pathname : raw;
    return path.split("/").pop() ?? raw;
  } catch {
    return raw.split("/").pop() ?? raw;
  }
}

/** Colour token from Headwear variant filename (null for hero / generic shots). */
export function headwearColorTokenFromFilename(
  fileNoQuery: string,
  styleCode?: string | null,
): string | null {
  const file = String(fileNoQuery ?? "").trim();
  if (!file) return null;
  const style = String(styleCode ?? "").trim();
  const styleLower = style.toLowerCase();

  if (style) {
    const underscore = file.match(
      new RegExp(`^${style}_([A-Za-z0-9][A-Za-z0-9_-]*)\\.(jpg|jpeg|png|webp)$`, "i"),
    );
    if (underscore?.[1]) return underscore[1];
    const aus = file.match(
      new RegExp(`^${styleLower}aus-([A-Za-z0-9][A-Za-z0-9_-]*)\\.(jpg|jpeg|png|webp)$`, "i"),
    );
    if (aus?.[1]) return aus[1];
    const hyphen = file.match(
      new RegExp(`^${styleLower}-(?!hero)([a-z0-9][a-z0-9-]*)\\.(jpg|jpeg|png|webp)$`, "i"),
    );
    if (hyphen?.[1] && hyphen[1] !== "mix") return hyphen[1];
  }

  // Generic fallbacks when style code is unknown.
  const headwearUnderscore = file.match(/^\d{3,5}_([A-Za-z0-9][A-Za-z0-9_-]*)\.(jpg|jpeg|png|webp)$/i);
  if (headwearUnderscore?.[1]) return headwearUnderscore[1];
  const headwearAus = file.match(/^\d{3,5}aus-([A-Za-z0-9][A-Za-z0-9_-]*)\.(jpg|jpeg|png|webp)$/i);
  if (headwearAus?.[1]) return headwearAus[1];
  const headwearHyphen = file.match(/^\d{3,5}-(?!hero)([a-z0-9][a-z0-9-]*)\.(jpg|jpeg|png|webp)$/i);
  if (headwearHyphen?.[1] && headwearHyphen[1] !== "mix") return headwearHyphen[1];

  return null;
}

export function isHeadwearStructuredVariantFilename(
  fileNoQuery: string,
  styleCode?: string | null,
): boolean {
  const file = String(fileNoQuery ?? "").trim();
  if (!file) return false;
  if (/hero/i.test(file)) return false;
  return headwearColorTokenFromFilename(file, styleCode) != null;
}

function humanizeHeadwearToken(token: string): string {
  return token
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Candidate storefront colour labels for a filename token (`Black-Red` → `Black / Red`, `Black Red`). */
export function headwearColorLabelCandidatesFromToken(token: string): string[] {
  const raw = String(token ?? "").trim();
  if (!raw) return [];
  const out: string[] = [];
  if (/[_-]/.test(raw)) {
    const parts = raw.split(/[_-]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      out.push(parts.map(titleCaseWord).join(" / "));
      out.push(parts.map(titleCaseWord).join(" "));
    }
  }
  const human = humanizeHeadwearToken(raw);
  if (human) {
    out.push(
      human
        .split(/\s+/)
        .map(titleCaseWord)
        .join(" "),
    );
  }
  return [...new Set(out.filter(Boolean))];
}

export function headwearUrlMatchesColor(
  url: string,
  color: string,
  styleCode?: string | null,
): boolean {
  const file = headwearFilenameTail(url).split("?")[0] ?? "";
  const token = headwearColorTokenFromFilename(file, styleCode);
  if (!token) return false;
  const want = compactColorKey(color);
  if (!want) return false;
  for (const label of headwearColorLabelCandidatesFromToken(token)) {
    if (compactColorKey(label) === want) return true;
  }
  return compactColorKey(token) === want;
}

/**
 * Reorder gallery: per-colour variant shots first (in chip order), lifestyle/extra shots after.
 */
export function resolveHeadwearPdpGalleryState(
  imageUrls: readonly string[],
  slug: string | null | undefined,
  colorOptions: readonly string[],
  styleCode?: string | null,
): { imageUrls: string[] } {
  const urls = imageUrls.map(String).filter((u) => u.trim().length > 0);
  if (!urls.length) {
    return { imageUrls: [] };
  }
  if (!isHeadwearStorefrontProduct(slug)) {
    return { imageUrls: urls };
  }

  const style = styleCode?.trim() || headwearStyleCodeFromSlug(slug) || null;
  const variant: string[] = [];
  const extra: string[] = [];

  for (const u of urls) {
    const file = headwearFilenameTail(u).split("?")[0] ?? "";
    if (isHeadwearStructuredVariantFilename(file, style)) {
      variant.push(u);
    } else {
      extra.push(u);
    }
  }

  if (!colorOptions.length || colorOptions.length <= 1) {
    return { imageUrls: [...variant, ...extra] };
  }

  const ordered: string[] = [];
  const used = new Set<string>();
  for (const color of colorOptions) {
    const hit = variant.find((u) => !used.has(u) && headwearUrlMatchesColor(u, color, style));
    if (hit) {
      ordered.push(hit);
      used.add(hit);
    }
  }
  for (const u of variant) {
    if (!used.has(u)) ordered.push(u);
  }
  return { imageUrls: [...ordered, ...extra] };
}

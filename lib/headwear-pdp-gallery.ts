/**
 * Headwear (Xada / BigCommerce) PDP gallery: variant filenames ↔ colour chips.
 * Patterns: `4199_Black.jpg`, `4199aus-brown.jpg`, `3975-black.jpg`, `4199aus-white-red_3.jpg`.
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

/** Strip BigCommerce duplicate suffixes (`white-red_3` → `white-red`). */
export function normalizeHeadwearColorFilenameToken(token: string): string {
  return String(token ?? "")
    .trim()
    .replace(/_\d+$/i, "")
    .trim();
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

  let token: string | null = null;
  if (style) {
    const underscore = file.match(
      new RegExp(`^${style}_([A-Za-z0-9][A-Za-z0-9_-]*)\\.(jpg|jpeg|png|webp)$`, "i"),
    );
    if (underscore?.[1]) token = underscore[1];
    if (!token) {
      const aus = file.match(
        new RegExp(`^${styleLower}aus-([A-Za-z0-9][A-Za-z0-9_-]*)\\.(jpg|jpeg|png|webp)$`, "i"),
      );
      if (aus?.[1]) token = aus[1];
    }
    if (!token) {
      const hyphen = file.match(
        new RegExp(`^${styleLower}-(?!hero)([a-z0-9][a-z0-9-]*)\\.(jpg|jpeg|png|webp)$`, "i"),
      );
      if (hyphen?.[1] && hyphen[1] !== "mix") token = hyphen[1];
    }
  }

  if (!token) {
    const headwearUnderscore = file.match(/^\d{3,5}_([A-Za-z0-9][A-Za-z0-9_-]*)\.(jpg|jpeg|png|webp)$/i);
    if (headwearUnderscore?.[1]) token = headwearUnderscore[1];
  }
  if (!token) {
    const headwearAus = file.match(/^\d{3,5}aus-([A-Za-z0-9][A-Za-z0-9_-]*)\.(jpg|jpeg|png|webp)$/i);
    if (headwearAus?.[1]) token = headwearAus[1];
  }
  if (!token) {
    const headwearHyphen = file.match(/^\d{3,5}-(?!hero)([a-z0-9][a-z0-9-]*)\.(jpg|jpeg|png|webp)$/i);
    if (headwearHyphen?.[1] && headwearHyphen[1] !== "mix") token = headwearHyphen[1];
  }

  return token ? normalizeHeadwearColorFilenameToken(token) : null;
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
  const raw = normalizeHeadwearColorFilenameToken(token);
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

/** Segments from a chip label (`Navy/Red`, `Hot Pink` → compact keys). */
function headwearColorLabelSegments(color: string): string[] {
  return String(color ?? "")
    .split(/[/\s]+/)
    .map((p) => compactColorKey(p.trim()))
    .filter((p) => p.length >= 2);
}

function headwearTokenSegments(token: string): string[] {
  return normalizeHeadwearColorFilenameToken(token)
    .split(/[_-]+/)
    .map((p) => compactColorKey(p.trim()))
    .filter((p) => p.length >= 2);
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

  const labelSegments = headwearColorLabelSegments(color);
  const tokenSegments = headwearTokenSegments(token);
  const tokenKey = compactColorKey(normalizeHeadwearColorFilenameToken(token));

  for (const label of headwearColorLabelCandidatesFromToken(token)) {
    if (compactColorKey(label) === want) return true;
  }

  if (tokenKey === want) return true;

  // Single-segment chip (`Red`, `Navy`) — only single-token files (`Red.jpg`, not `Navy-Red.jpg`).
  if (labelSegments.length === 1) {
    return tokenSegments.length === 1 && tokenKey === labelSegments[0];
  }

  // Combo chip (`Navy/Red`, `White/Red`) — full token must match all segments.
  if (tokenSegments.length >= 2 && labelSegments.length >= 2) {
    if (tokenKey === want) return true;
    if (tokenSegments.length === labelSegments.length) {
      for (let i = 0; i < labelSegments.length; i++) {
        if (tokenSegments[i] !== labelSegments[i]) return false;
      }
      return true;
    }
  }

  // Multi-word single chip (`Hot Pink`) ↔ lone token file (`Pink`) — not slash combos (`White/Navy`).
  if (!color.includes("/") && labelSegments.length >= 2 && tokenSegments.length === 1) {
    const last = labelSegments[labelSegments.length - 1];
    if (last && last === tokenKey) return true;
  }

  return false;
}

/**
 * Best variant image for a colour chip — filename rules first, then sync index when it agrees.
 */
export function headwearPickImageForColor(
  urls: readonly string[],
  color: string,
  colorOptions: readonly string[],
  styleCode?: string | null,
  slug?: string | null,
): string | null {
  const list = urls.map((s) => String(s ?? "").trim()).filter(Boolean);
  const trimmed = color.trim();
  if (!trimmed || !list.length) return null;
  const style = styleCode?.trim() || headwearStyleCodeFromSlug(slug) || null;
  if (!isHeadwearStorefrontProduct(slug) && !style) return null;

  for (const u of list) {
    if (headwearUrlMatchesColor(u, trimmed, style)) {
      return u;
    }
  }

  const want = compactColorKey(trimmed);
  let colorIdx = -1;
  for (let i = 0; i < colorOptions.length; i++) {
    const c = colorOptions[i] ?? "";
    if (compactColorKey(c) === want || c.trim().toLowerCase() === trimmed.toLowerCase()) {
      colorIdx = i;
      break;
    }
  }

  if (colorIdx >= 0 && colorIdx < list.length && list.length >= colorOptions.length) {
    const atIdx = list[colorIdx]!;
    if (headwearUrlMatchesColor(atIdx, trimmed, style)) {
      return atIdx;
    }
  }

  return null;
}

/**
 * Variant shots first (sync order = chip order), lifestyle / extra shots after.
 */
export function resolveHeadwearPdpGalleryState(
  imageUrls: readonly string[],
  slug: string | null | undefined,
  _colorOptions?: readonly string[],
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

  return { imageUrls: [...variant, ...extra] };
}

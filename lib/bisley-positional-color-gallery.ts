/**
 * Bisley PDP: some drill / shirt lines use `STYLE_CODE-0.jpg` assets where the middle token is a
 * stable catalogue code order (not a reliable semantic map for every code → colour name).
 * Gallery order is aligned to `available_colors` by sorting known codes in this order.
 */
// Drill/shirt lines: BPCT = Navy; BCDR = Khaki; BVCB = Royal; BSAN/BSAND = Sand
// so the stable catalogue order for chip ↔ gallery is: Khaki → Navy → Royal → Sand.
export const BISLEY_POSITIONAL_FILENAME_CODE_ORDER = ["BCDR", "BPCT", "BVCB", "BSAN"] as const;

/**
 * Some Bisley assets use `BSAND` in the filename token; it occupies the same catalogue slot as `BSAN`
 * (third image in `BISLEY_POSITIONAL_FILENAME_CODE_ORDER`).
 */
export function bisleyNormalizePositionalFilenameCode(raw: string | null | undefined): string | null {
  const u = String(raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (!u) return null;
  if (u === "BSAND") return "BSAN";
  const order = BISLEY_POSITIONAL_FILENAME_CODE_ORDER as readonly string[];
  return order.includes(u) ? u : null;
}

/** Storefront labels in the same order as `BISLEY_POSITIONAL_FILENAME_CODE_ORDER` / Bisley flat assets. */
export const BISLEY_POSITIONAL_GALLERY_COLOR_LABELS = ["Khaki", "Navy", "Royal", "Sand"] as const;

/** Product style codes that share this filename pattern (slug `bis-{style}` or name suffix `(STYLE)`). */
export const BISLEY_POSITIONAL_CODE_GALLERY_STYLE_CODES = [
  "BSC1820",
  "BSC6820",
  "BSC1433",
  "BSC6433",
  "BS1893",
  "BS6893",
] as const;

export const BISLEY_POSITIONAL_CODE_GALLERY_STYLES = new Set<string>([
  ...BISLEY_POSITIONAL_CODE_GALLERY_STYLE_CODES,
]);

/** `bis-bsc1820` → `BSC1820`; ignores unknown `bis-*` slugs. */
export function bisleyPositionalGalleryStyleUpperFromSlugOrName(
  slugLower: string,
  styleFromName: string,
): string {
  const s = slugLower.trim().toLowerCase();
  const fromSlug = s.startsWith("bis-") ? s.replace(/^bis-/, "").replace(/-/g, "").toUpperCase() : "";
  if (fromSlug && BISLEY_POSITIONAL_CODE_GALLERY_STYLES.has(fromSlug)) {
    return fromSlug;
  }
  const u = String(styleFromName ?? "")
    .trim()
    .toUpperCase();
  if (BISLEY_POSITIONAL_CODE_GALLERY_STYLES.has(u)) {
    return u;
  }
  return "";
}

export function bisleySlugUsesPositionalColorGallery(slugLower: string): boolean {
  const s = slugLower.trim().toLowerCase();
  if (!s.startsWith("bis-")) {
    return false;
  }
  const style = s.replace(/^bis-/, "").replace(/-/g, "").toUpperCase();
  return BISLEY_POSITIONAL_CODE_GALLERY_STYLES.has(style);
}

/**
 * Extract Bisley catalogue colour token from an image URL. Prefer the path basename
 * (`BSC6820_BPCT-0.jpg`); fall back to scanning the full string for known codes so
 * `/api/supplier-media/.../nested_BSC6820_BSAND-0.jpg` still works.
 */
export function bisleyPositionalRawCodeFromImageUrl(url: string): string | null {
  const tail = String(url).split("/").pop() ?? String(url);
  let file = tail;
  try {
    file = decodeURIComponent(tail);
  } catch {
    file = tail;
  }
  const fileNoQuery = (file.split("?")[0] ?? "").trim();
  const head = fileNoQuery.match(/^[A-Za-z0-9]+[_-]([A-Za-z0-9]{3,6})[_-]/);
  if (head?.[1]) {
    const token = String(head[1]).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    // Some feeds put the colour *word* in the token slot (e.g. `..._KHAKI_Front.jpg`).
    // Convert those to the positional drill/shirt codes.
    if (token === "KHAKI") return "BCDR";
    if (token === "NAVY") return "BPCT";
    if (token === "ROYAL") return "BVCB";
    if (token === "SAND") return "BSAN";
    if (token === "BOTTLE") return "BGRG";
    if (token === "ORANGE") return "BVEO";
    return token;
  }
  // Some feeds put the colour word after the style with hyphens (e.g. `BS6144-CHARCOAL.jpg`, `BS6144-STONE-FRONT.jpg`).
  const hy = fileNoQuery.toUpperCase().match(/^[A-Z0-9]+-([A-Z]{3,12})(?:-|\\.|$)/);
  if (hy?.[1]) {
    const t = String(hy[1]);
    if (t === "BLACK") return "BLACK";
    if (t === "CHARCOAL") return "BCCG";
    if (t === "NAVY") return "BPCT";
    if (t === "STONE") return "BSTN";
    if (t === "SAND") return "BSAN";
  }
  let full = String(url);
  try {
    full = decodeURIComponent(full);
  } catch {
    full = String(url);
  }
  // BSAND before BSAN so we do not match the `SAN` inside `BSAND`.
  const m = full.match(
    /(?:^|[\/_-])(BCDR|BPCT|BSAND|BSAN|BVCB)(?=[_\-./]|\.(?:jpe?g|png|webp)\b|$)/i,
  );
  if (m?.[1]) {
    return String(m[1]).toUpperCase();
  }
  // Some feeds use plain colour words for the khaki slot (e.g. `BSC6820_KHAKI_Front.jpg`).
  // Map them into the positional order so chip ↔ hero remains deterministic.
  const up = full.toUpperCase();
  if (/(?:^|[\/_ -])KHAKI(?:[\/_ .-]|$)/.test(up)) return "BCDR";
  if (/(?:^|[\/_ -])NAVY(?:[\/_ .-]|$)/.test(up)) return "BPCT";
  if (/(?:^|[\/_ -])ROYAL(?:[\/_ .-]|$)/.test(up)) return "BVCB";
  if (/(?:^|[\/_ -])SAND(?:[\/_ .-]|$)/.test(up)) return "BSAN";
  if (/(?:^|[\/_ -])BOTTLE(?:[\/_ .-]|$)/.test(up)) return "BGRG";
  if (/(?:^|[\/_ -])ORANGE(?:[\/_ .-]|$)/.test(up)) return "BVEO";
  return null;
}

/** Map Bisley drill/shirt filename token to storefront colour label. */
export function bisleyDrillColorLabelFromCode(codeRaw: string | null | undefined): string | null {
  const u = String(codeRaw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (!u) return null;
  const map: Record<string, string> = {
    BCDR: "Khaki",
    BPCT: "Navy",
    // Sand tokens.
    BSAN: "Sand",
    BSAND: "Sand",
    // Royal in drills.
    BVCB: "Royal",
    // Other drills.
    BGRG: "Bottle",
    BVEO: "Orange",
  };
  return map[u] ?? null;
}

/** Derive a colour label from a Bisley drill/shirt image URL. */
export function bisleyDrillColorLabelFromImageUrl(url: string): string | null {
  const raw = bisleyPositionalRawCodeFromImageUrl(url);
  const mapped = bisleyDrillColorLabelFromCode(raw);
  if (mapped) return mapped;
  return null;
}

/**
 * Reorder drill/shirt gallery URLs to match the DB chip order.
 * Only reorders colours we can confidently map; leaves the rest appended.
 */
export function bisleyReorderDrillImagesToMatchColors(
  urls: readonly string[],
  colorOptions: readonly string[],
): string[] | null {
  if (!Array.isArray(urls) || urls.length < 2) return null;
  if (!Array.isArray(colorOptions) || colorOptions.length < 2) return null;
  const byColor = new Map<string, string>();
  for (const u of urls) {
    if (typeof u !== "string" || !u.trim()) continue;
    const c = bisleyDrillColorLabelFromImageUrl(u);
    if (!c) continue;
    const key = c.trim().toLowerCase();
    if (!byColor.has(key)) byColor.set(key, u);
  }
  const ordered: string[] = [];
  const used = new Set<string>();
  for (const c of colorOptions) {
    const key = String(c ?? "").trim().toLowerCase();
    const u = byColor.get(key);
    if (u) {
      ordered.push(u);
      used.add(u);
    }
  }
  if (ordered.length < 2) return null;
  const rest = urls.filter((u) => typeof u === "string" && u.trim() && !used.has(u));
  return [...ordered, ...rest];
}

/** Normalized positional slots present across `urls` (BSAND → BSAN). */
export function bisleyPositionalNormalizedCodesFromUrls(urls: readonly string[]): Set<string> {
  const filled = new Set<string>();
  for (const u of urls) {
    if (typeof u !== "string" || !u.trim()) continue;
    const n = bisleyNormalizePositionalFilenameCode(bisleyPositionalRawCodeFromImageUrl(u));
    if (n) filled.add(n);
  }
  return filled;
}

/**
 * When all four positional codes are present, return URLs reordered to
 * BCDR → BPCT → BSAN → BVCB with any unmatched URLs appended.
 */
export function bisleySortedPositionalImageUrlsIfComplete(urls: readonly string[]): string[] | null {
  if (urls.length < 4) return null;
  if (bisleyPositionalNormalizedCodesFromUrls(urls).size !== 4) return null;

  type Row = { url: string; code: string; ord: number };
  const order = BISLEY_POSITIONAL_FILENAME_CODE_ORDER as readonly string[];
  const rows: Row[] = [];
  for (const u of urls) {
    if (typeof u !== "string" || !u.trim()) continue;
    const code = bisleyNormalizePositionalFilenameCode(bisleyPositionalRawCodeFromImageUrl(u));
    if (!code) continue;
    rows.push({ url: u, code, ord: order.indexOf(code) });
  }
  const byCode = new Map<string, string>();
  for (const r of [...rows].sort((a, b) => a.ord - b.ord || a.url.localeCompare(b.url))) {
    if (!byCode.has(r.code)) byCode.set(r.code, r.url);
  }
  if (byCode.size !== 4) return null;
  const orderedUrls = BISLEY_POSITIONAL_FILENAME_CODE_ORDER.map((c) => byCode.get(c)).filter(
    (x): x is string => Boolean(x),
  );
  if (orderedUrls.length !== 4) return null;
  const used = new Set(orderedUrls);
  const rest = urls.filter((u) => typeof u === "string" && u.trim() && !used.has(u));
  return [...orderedUrls, ...rest];
}

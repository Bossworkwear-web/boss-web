/** JB's Wear 7PIP — default PDP colour chip + hero gallery. */
export const JB_7PIP_DEFAULT_FIRST_COLOR = "Black/Red";

function compactColorKey(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isJb7pipListing(styleCodeUpper: string | null): boolean {
  return styleCodeUpper === "7PIP";
}

export function matchesJb7pipBlackRedColor(label: string): boolean {
  const key = compactColorKey(label);
  return key === "blackred" || key === compactColorKey(JB_7PIP_DEFAULT_FIRST_COLOR);
}

/** Move Black/Red to index 0; swap matching `#jbpc` prefix heroes when present. */
export function applyJb7pipBlackRedFirstPdp<T extends string>(
  styleCodeUpper: string | null,
  colors: readonly T[],
  imageUrls: readonly string[],
  jbPrefixCount: number,
): { colors: T[]; imageUrls: string[] } {
  if (!isJb7pipListing(styleCodeUpper) || colors.length < 2) {
    return { colors: [...colors], imageUrls: [...imageUrls] };
  }

  const idx = colors.findIndex((c) => matchesJb7pipBlackRedColor(String(c)));
  if (idx <= 0) {
    return { colors: [...colors], imageUrls: [...imageUrls] };
  }

  const colorsOut = [...colors];
  const [picked] = colorsOut.splice(idx, 1);
  colorsOut.unshift(picked);

  const urlsOut = [...imageUrls];
  if (jbPrefixCount > 0 && idx < jbPrefixCount && urlsOut.length >= jbPrefixCount) {
    const jbpcMatch = urlsOut[0]?.match(/#jbpc=\d+$/i);
    const jbpcSuffix = jbpcMatch?.[0] ?? "";
    const stripJbpc = (u: string) => u.replace(/#jbpc=\d+$/i, "");
    const atIdx = stripJbpc(urlsOut[idx] ?? "");
    const atZero = stripJbpc(urlsOut[0] ?? "");
    urlsOut[0] = jbpcSuffix ? `${atIdx}${jbpcSuffix}` : atIdx;
    urlsOut[idx] = atZero;
  }

  return { colors: colorsOut, imageUrls: urlsOut };
}

export function parseJbGalleryPrefixCount(imageUrls: readonly string[]): number {
  const first = typeof imageUrls[0] === "string" ? imageUrls[0] : "";
  const m = /#jbpc=(\d+)$/i.exec(first);
  if (!m?.[1]) {
    return 0;
  }
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function jbStyleCodeUpperFromListing(name: string, slug?: string | null): string | null {
  const s = String(slug ?? "").trim().toLowerCase();
  if (s.startsWith("jb-")) {
    const rest = s.slice(3).replace(/-/g, "");
    if (rest && /^[a-z0-9]{2,12}$/.test(rest)) {
      return rest.toUpperCase();
    }
  }
  const m = name.trim().match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/);
  return m ? m[1].toUpperCase().replace(/-CLEARANCE$/i, "") : null;
}

/** Category/search card hero for 7PIP — Black/Red garment image when available. */
export function jb7pipCategoryBrowseHeroUrl(
  styleCodeUpper: string | null,
  imageUrls: readonly string[] | null | undefined,
  availableColors: readonly string[] | null | undefined,
): string | null {
  if (!isJb7pipListing(styleCodeUpper)) {
    return null;
  }
  const urls = (imageUrls ?? []).map((u) => String(u).trim()).filter(Boolean);
  if (!urls.length) {
    return null;
  }
  const colors = (availableColors ?? []).map((c) => String(c).trim()).filter(Boolean);
  const prefixCount = parseJbGalleryPrefixCount(urls);
  const { imageUrls: ordered } = applyJb7pipBlackRedFirstPdp(styleCodeUpper, colors, urls, prefixCount);
  const first = ordered[0]?.replace(/#jbpc=\d+$/i, "").trim();
  return first || null;
}

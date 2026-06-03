/** Main category slugs where JB's Wear listings are shown first (default sort). */
const JBS_WEAR_PRIORITY_MAIN_SLUGS = new Set(["workwear", "mens", "womens"]);

/** Men's main browse: JB's Wear styles pinned to the first row (in this order). */
const MENS_JB_WEAR_LEADING_STYLE_CODES = ["7PIP", "7PIPL", "7SPP"] as const;

const MENS_JB_WEAR_LEADING_RANK = new Map<string, number>(
  MENS_JB_WEAR_LEADING_STYLE_CODES.map((code, index) => [code, index]),
);

const TRAILING_STYLE_PAREN_RE = /\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/;

export type CategoryBrowseSortItem = {
  name: string;
  slug?: string | null;
};

export function isJbsWearBrandLabel(brand: string): boolean {
  const lower = brand.trim().toLowerCase();
  return (
    lower === "jb's wear" ||
    lower === "jbs wear" ||
    lower === "jbswear" ||
    /\bjbs\s*wear\b/i.test(lower)
  );
}

function jbStyleCodeFromListing(name: string, slug?: string | null): string | null {
  const s = String(slug ?? "").trim().toLowerCase();
  if (s) {
    const atEnd = /(?:^|-)(jb-[a-z0-9][a-z0-9_-]*)$/i.exec(s);
    const seg = (atEnd ? atEnd[1] : /(?:^|-)(jb-[a-z0-9][a-z0-9_-]*)/i.exec(s)?.[1]) ?? null;
    if (seg?.startsWith("jb-")) {
      const rest = seg.slice(3);
      const parts = rest.split("-").filter(Boolean);
      const tail = parts.length ? parts[parts.length - 1] : "";
      if (/^[a-z0-9]{3,20}$/i.test(tail)) {
        return tail.toUpperCase().replace(/-CLEARANCE$/i, "");
      }
    }
  }
  const m = name.trim().match(TRAILING_STYLE_PAREN_RE);
  return m ? m[1].toUpperCase().replace(/-CLEARANCE$/i, "") : null;
}

function mensJbWearLeadingRank(
  mainSlug: string,
  item: CategoryBrowseSortItem,
  brand: string,
): number | null {
  if (mainSlug !== "mens" || !isJbsWearBrandLabel(brand)) {
    return null;
  }
  const code = jbStyleCodeFromListing(item.name, item.slug);
  if (!code) {
    return null;
  }
  const rank = MENS_JB_WEAR_LEADING_RANK.get(code);
  return rank === undefined ? null : rank;
}

/** Default category browse order: JB's Wear first (on selected mains), then name A–Z. */
export function compareCategoryBrowseDefaultSort<T extends CategoryBrowseSortItem>(
  mainSlug: string,
  a: T,
  b: T,
  brandOf: (item: T) => string,
): number {
  if (mainSlug === "mens") {
    const aLead = mensJbWearLeadingRank(mainSlug, a, brandOf(a));
    const bLead = mensJbWearLeadingRank(mainSlug, b, brandOf(b));
    const aHas = aLead != null;
    const bHas = bLead != null;
    if (aHas !== bHas) {
      return aHas ? -1 : 1;
    }
    if (aHas && bHas && aLead !== bLead) {
      return aLead - bLead;
    }
  }

  if (JBS_WEAR_PRIORITY_MAIN_SLUGS.has(mainSlug)) {
    const aJb = isJbsWearBrandLabel(brandOf(a));
    const bJb = isJbsWearBrandLabel(brandOf(b));
    if (aJb !== bJb) {
      return aJb ? -1 : 1;
    }
  }
  return a.name.localeCompare(b.name);
}

export function sortCategoryBrowseDefault<T extends CategoryBrowseSortItem>(
  mainSlug: string,
  rows: T[],
  brandOf: (item: T) => string,
): T[] {
  return [...rows].sort((a, b) => compareCategoryBrowseDefaultSort(mainSlug, a, b, brandOf));
}

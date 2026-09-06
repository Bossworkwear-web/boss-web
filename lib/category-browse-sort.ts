import { headwearStyleCodeFromSlug } from "@/lib/headwear-pdp-gallery";

/** Main category slugs where JB's Wear listings are shown first (default sort). */
const JBS_WEAR_PRIORITY_MAIN_SLUGS = new Set(["workwear", "mens", "womens"]);

/** Men's / Women's main browse: JB's Wear polo styles pinned to the first row (in this order). */
const JB_WEAR_POLO_PRIORITY_MAIN_SLUGS = new Set(["mens", "womens"]);

const JB_WEAR_POLO_LEADING_STYLE_CODES = ["7PIP", "7PIPL", "7SPP"] as const;

const JB_WEAR_POLO_LEADING_RANK = new Map<string, number>(
  JB_WEAR_POLO_LEADING_STYLE_CODES.map((code, index) => [code, index]),
);

/** Workwear main browse: Blue Whale styles pinned to the first row (in this order). */
const WORKWEAR_BLUE_WHALE_LEADING_STYLE_CODES = ["C91", "C81"] as const;

const WORKWEAR_BLUE_WHALE_LEADING_RANK = new Map<string, number>(
  WORKWEAR_BLUE_WHALE_LEADING_STYLE_CODES.map((code, index) => [code, index]),
);

/** PPE → Head Wear: style codes pinned to the first row (in this order). */
const PPE_HEAD_WEAR_LEADING_STYLE_CODES = ["4199"] as const;

const PPE_HEAD_WEAR_LEADING_RANK = new Map<string, number>(
  PPE_HEAD_WEAR_LEADING_STYLE_CODES.map((code, index) => [code, index]),
);

/**
 * Chef → Jackets: JB chef jacket product lines kept adjacent within each family.
 * Each family shares one A–Z sort anchor (first style) so cards stay together.
 */
const CHEF_JACKETS_PRODUCT_FAMILIES: readonly {
  codes: readonly string[];
  sortAnchor: string;
}[] = [
  {
    codes: ["5CJ", "5CJ1", "5CJ2", "5CJ21"],
    sortAnchor: "JB's Wear JB's L/S CHEFS JACKET (5CJ)",
  },
  {
    codes: ["5CJL", "5CJL1", "5CJS", "5CJS1"],
    sortAnchor: "JB's Wear JB's L/S SNAP BUTTON CHEFS JACKET (5CJL)",
  },
  {
    codes: ["5MP", "5LP"],
    sortAnchor: "JB's Wear JB's CHEF POLO (5MP)",
  },
];

type ChefJacketsFamilyPlacement = {
  familyIndex: number;
  rank: number;
  sortAnchor: string;
};

const CHEF_JACKETS_FAMILY_PLACEMENT_BY_STYLE = new Map<string, ChefJacketsFamilyPlacement>(
  CHEF_JACKETS_PRODUCT_FAMILIES.flatMap((family, familyIndex) =>
    family.codes.map((code, rank) => [
      code,
      { familyIndex, rank, sortAnchor: family.sortAnchor },
    ]),
  ),
);

const TRAILING_STYLE_PAREN_RE = /\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/;

export type CategoryBrowseSortItem = {
  name: string;
  slug?: string | null;
  category?: string | null;
  description?: string | null;
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

export function looksLikePoloListing(item: CategoryBrowseSortItem): boolean {
  const hay = `${item.name} ${item.category ?? ""} ${item.description ?? ""}`.toLowerCase();
  return /\bpolos?\b/.test(hay);
}

export function isBlueWhaleBrandLabel(brand: string): boolean {
  const lower = brand.trim().toLowerCase();
  return lower === "blue whale" || /\bblue\s*whale\b/.test(lower);
}

function blueWhaleStyleCodeFromListing(name: string, slug?: string | null): string | null {
  const m = name.trim().match(TRAILING_STYLE_PAREN_RE);
  if (m) {
    return m[1].toUpperCase().replace(/-CLEARANCE$/i, "");
  }
  const slugLc = String(slug ?? "").trim().toLowerCase();
  if (!slugLc) {
    return null;
  }
  const bw = /(?:^|-)blue-whale-([a-z0-9]{2,12})(?:-|$)/i.exec(slugLc);
  if (bw?.[1]) {
    return bw[1].toUpperCase();
  }
  const tail = /(?:^|-)([a-z0-9]{2,12})$/i.exec(slugLc);
  return tail?.[1] ? tail[1].toUpperCase() : null;
}

function headWearStyleCodeFromListing(item: CategoryBrowseSortItem): string | null {
  const fromSlug = headwearStyleCodeFromSlug(item.slug);
  if (fromSlug) {
    return fromSlug;
  }
  const m = item.name.trim().match(TRAILING_STYLE_PAREN_RE);
  return m ? m[1].toUpperCase().replace(/-CLEARANCE$/i, "") : null;
}

function ppeHeadWearLeadingRank(
  mainSlug: string,
  subSlug: string | undefined,
  item: CategoryBrowseSortItem,
): number | null {
  if (mainSlug !== "ppe" || subSlug !== "head-wear") {
    return null;
  }
  const code = headWearStyleCodeFromListing(item);
  if (!code) {
    return null;
  }
  const rank = PPE_HEAD_WEAR_LEADING_RANK.get(code);
  return rank === undefined ? null : rank;
}

function workwearBlueWhaleLeadingRank(
  mainSlug: string,
  item: CategoryBrowseSortItem,
  brand: string,
): number | null {
  if (mainSlug !== "workwear" || !isBlueWhaleBrandLabel(brand)) {
    return null;
  }
  const code = blueWhaleStyleCodeFromListing(item.name, item.slug);
  if (!code) {
    return null;
  }
  const rank = WORKWEAR_BLUE_WHALE_LEADING_RANK.get(code);
  return rank === undefined ? null : rank;
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

/** 0 = JB polo, 1 = JB non-polo, 2 = other brands (mens / womens only). */
function jbPoloPriorityBrowseSortTier(
  mainSlug: string,
  item: CategoryBrowseSortItem,
  brand: string,
): number {
  if (!JB_WEAR_POLO_PRIORITY_MAIN_SLUGS.has(mainSlug)) {
    return 2;
  }
  if (!isJbsWearBrandLabel(brand)) {
    return 2;
  }
  return looksLikePoloListing(item) ? 0 : 1;
}

function jbWearPoloLeadingRank(
  mainSlug: string,
  item: CategoryBrowseSortItem,
  brand: string,
): number | null {
  if (
    !JB_WEAR_POLO_PRIORITY_MAIN_SLUGS.has(mainSlug) ||
    !isJbsWearBrandLabel(brand) ||
    !looksLikePoloListing(item)
  ) {
    return null;
  }
  const code = jbStyleCodeFromListing(item.name, item.slug);
  if (!code) {
    return null;
  }
  const rank = JB_WEAR_POLO_LEADING_RANK.get(code);
  return rank === undefined ? null : rank;
}

function chefJacketsFamilyPlacement(
  mainSlug: string,
  subSlug: string | undefined,
  item: CategoryBrowseSortItem,
): ChefJacketsFamilyPlacement | null {
  if (mainSlug !== "chef" || subSlug !== "jackets") {
    return null;
  }
  const code = jbStyleCodeFromListing(item.name, item.slug);
  if (!code) {
    return null;
  }
  return CHEF_JACKETS_FAMILY_PLACEMENT_BY_STYLE.get(code) ?? null;
}

function categoryBrowseNameSortKey(
  item: CategoryBrowseSortItem,
  chefFamily: ChefJacketsFamilyPlacement | null,
): string {
  if (chefFamily) {
    return chefFamily.sortAnchor;
  }
  return item.name;
}

/** Default category browse order: JB's Wear first (on selected mains), then name A–Z. */
export function compareCategoryBrowseDefaultSort<T extends CategoryBrowseSortItem>(
  mainSlug: string,
  a: T,
  b: T,
  brandOf: (item: T) => string,
  subSlug?: string,
): number {
  if (mainSlug === "ppe" && subSlug === "head-wear") {
    const aLead = ppeHeadWearLeadingRank(mainSlug, subSlug, a);
    const bLead = ppeHeadWearLeadingRank(mainSlug, subSlug, b);
    const aHas = aLead != null;
    const bHas = bLead != null;
    if (aHas !== bHas) {
      return aHas ? -1 : 1;
    }
    if (aHas && bHas && aLead !== bLead) {
      return aLead - bLead;
    }
  }

  if (mainSlug === "workwear") {
    const aLead = workwearBlueWhaleLeadingRank(mainSlug, a, brandOf(a));
    const bLead = workwearBlueWhaleLeadingRank(mainSlug, b, brandOf(b));
    const aHas = aLead != null;
    const bHas = bLead != null;
    if (aHas !== bHas) {
      return aHas ? -1 : 1;
    }
    if (aHas && bHas && aLead !== bLead) {
      return aLead - bLead;
    }
  }

  if (JB_WEAR_POLO_PRIORITY_MAIN_SLUGS.has(mainSlug)) {
    const aTier = jbPoloPriorityBrowseSortTier(mainSlug, a, brandOf(a));
    const bTier = jbPoloPriorityBrowseSortTier(mainSlug, b, brandOf(b));
    if (aTier !== bTier) {
      return aTier - bTier;
    }
    if (aTier === 0) {
      const aLead = jbWearPoloLeadingRank(mainSlug, a, brandOf(a));
      const bLead = jbWearPoloLeadingRank(mainSlug, b, brandOf(b));
      const aHas = aLead != null;
      const bHas = bLead != null;
      if (aHas !== bHas) {
        return aHas ? -1 : 1;
      }
      if (aHas && bHas && aLead !== bLead) {
        return aLead - bLead;
      }
    }
  }

  if (JBS_WEAR_PRIORITY_MAIN_SLUGS.has(mainSlug)) {
    const aJb = isJbsWearBrandLabel(brandOf(a));
    const bJb = isJbsWearBrandLabel(brandOf(b));
    if (aJb !== bJb) {
      return aJb ? -1 : 1;
    }
  }

  const aChefFam = chefJacketsFamilyPlacement(mainSlug, subSlug, a);
  const bChefFam = chefJacketsFamilyPlacement(mainSlug, subSlug, b);
  if (aChefFam && bChefFam && aChefFam.familyIndex === bChefFam.familyIndex && aChefFam.rank !== bChefFam.rank) {
    return aChefFam.rank - bChefFam.rank;
  }

  return categoryBrowseNameSortKey(a, aChefFam).localeCompare(categoryBrowseNameSortKey(b, bChefFam));
}

export function sortCategoryBrowseDefault<T extends CategoryBrowseSortItem>(
  mainSlug: string,
  rows: T[],
  brandOf: (item: T) => string,
  subSlug?: string,
): T[] {
  return [...rows].sort((a, b) => compareCategoryBrowseDefaultSort(mainSlug, a, b, brandOf, subSlug));
}

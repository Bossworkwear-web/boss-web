import { fashionBizListingGenderAudience } from "@/lib/fashion-biz-gender-route";

/** Letter sizing for men's / unisex tops (and many men's workwear bottoms use numeric waist — CSV still wins). */
const MENS_LETTER_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
  "6XL",
  "7XL",
  "8XL",
  "9XL",
  "10XL",
] as const;

const LETTER_RANK = new Map<string, number>(
  MENS_LETTER_ORDER.map((s, i) => [s, i] as [string, number]),
);

const KIDS_NUMERIC_FALLBACK = ["4", "6", "8", "10", "12", "14", "16"] as const;

/** Common AU women's numeric 6–24 (CSV supplies exact list when available). */
const WOMENS_NUMERIC_FALLBACK = ["6", "8", "10", "12", "14", "16", "18", "20", "22", "24"] as const;

const MENS_ALPHA_FALLBACK = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] as const;

function isOneSizeToken(s: string): boolean {
  return /^one\s*size$/i.test(s) || s.toUpperCase() === "FRE";
}

function isPlainIntegerSize(s: string): boolean {
  return /^\d+$/.test(s.trim());
}

function letterRank(s: string): number {
  const k = s.trim().toUpperCase().replace(/\s+/g, "");
  return LETTER_RANK.get(k) ?? 999;
}

function canonicalSizeToken(s: string): string {
  const t = s.trim();
  if (!t) {
    return "";
  }
  if (isOneSizeToken(t)) {
    return "One Size";
  }
  if (isPlainIntegerSize(t)) {
    return String(parseInt(t, 10));
  }
  const r = letterRank(t);
  if (r < 999) {
    return MENS_LETTER_ORDER[r];
  }
  return t.toUpperCase().replace(/\s+/g, "");
}

/** When sum.csv / DB has no sizes: men's letters, women's numerals, kids' numerals. */
export function resolveSizeFallbackForProduct(
  productName: string,
  storeSlug?: string | null,
  category?: string | null,
): string[] {
  const aud = fashionBizListingGenderAudience(productName, storeSlug ?? null, category ?? null);
  if (aud === "kids") {
    return [...KIDS_NUMERIC_FALLBACK];
  }
  if (aud === "womens") {
    return [...WOMENS_NUMERIC_FALLBACK];
  }
  /** Syzmik and other lines: not CSV-gated by BizCare/BizCollection but title says Womens → numeric. */
  if (/\bwomens\b/i.test(productName) || /\bladies\b/i.test(productName)) {
    return [...WOMENS_NUMERIC_FALLBACK];
  }
  return [...MENS_ALPHA_FALLBACK];
}

/**
 * Deduplicate and order sizes for PDP: one-size → letter (XS…5XL) → plain integers ascending → other (e.g. 77, 3/77).
 */
export function sortSizesForDisplay(sizes: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of sizes) {
    const t = raw.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    unique.push(t);
  }

  const one = unique.filter(isOneSizeToken);
  const rest = unique.filter((s) => !isOneSizeToken(s));
  const plainNums = rest.filter(isPlainIntegerSize);
  const letters = rest.filter((s) => !isPlainIntegerSize(s) && letterRank(s) < 999);
  const other = rest.filter(
    (s) => !isPlainIntegerSize(s) && !letters.includes(s),
  );

  plainNums.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  letters.sort((a, b) => letterRank(a) - letterRank(b) || a.localeCompare(b));
  other.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return [...one, ...letters, ...plainNums, ...other];
}

export function normalizeProductSizeOptions(
  raw: string[] | null | undefined,
  productName: string,
  storeSlug?: string | null,
  category?: string | null,
): string[] {
  const cleaned = (raw ?? []).map((s) => canonicalSizeToken(s)).filter(Boolean);
  const deduped = [...new Set(cleaned)];
  if (deduped.length >= 1) {
    return sortSizesForDisplay(deduped);
  }
  return sortSizesForDisplay(resolveSizeFallbackForProduct(productName, storeSlug ?? null, category ?? null));
}

import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import { storefrontProductNameWithoutBrand } from "@/lib/product-display-name";

const TRAILING_STYLE_PAREN_RE = /\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/;

/** Optional catalogue fields used for storefront / autocomplete search. */
export type ProductSearchExtras = {
  supplierName?: string | null;
  colors?: readonly string[] | null;
  sizes?: readonly string[] | null;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match a term as its own word (avoids `vest` inside `invest`, `harvest`, `sleeve`, …). */
function containsTermAsWord(text: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) {
    return false;
  }
  const hay = text.toLowerCase();
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(t)}(?:$|[^a-z0-9])`);
  return re.test(hay);
}

function trailingStyleCodeFromName(name: string): string | null {
  const m = name.trim().match(TRAILING_STYLE_PAREN_RE);
  return m ? m[1].toUpperCase() : null;
}

function slugSegments(slug: string | null | undefined): string[] {
  if (!slug?.trim()) {
    return [];
  }
  return slug
    .split(/[-_]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenizeSearchQuery(rawQuery: string): string[] {
  return rawQuery
    .trim()
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.replace(/^['"]+|['"]+$/g, ""))
    .filter((t) => t.length > 0);
}

/** Letter-only queries (e.g. vest, polo) — use word boundaries instead of raw substring. */
function isWordOrientedSearchQuery(rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q || /\d/.test(q)) {
    return false;
  }
  return /^[a-zA-Z][a-zA-Z\s'/-]*$/.test(q);
}

function compactUpper(s: string): string {
  return s.replace(/[\s_/-]+/g, "").toUpperCase();
}

function matchesHiVisSynonym(compactQuery: string, compactBlob: string): boolean {
  const queryIsHiVis = /^(HI|HIGH)VI[SZ]/.test(compactQuery) || compactQuery === "HV";
  if (!queryIsHiVis) {
    return false;
  }
  return compactBlob.includes("HV") || /HI(GH)?VI[SZ]/.test(compactBlob);
}

function joinListField(values: readonly string[] | null | undefined): string {
  if (!values?.length) {
    return "";
  }
  return values
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/** Levenshtein distance with early exit when beyond `max`. */
export function levenshteinDistance(a: string, b: string, max = Infinity): number {
  if (a === b) {
    return 0;
  }
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > max) {
    return max + 1;
  }
  if (al === 0) {
    return bl;
  }
  if (bl === 0) {
    return al;
  }
  let prev = new Array<number>(bl + 1);
  let curr = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) {
    prev[j] = j;
  }
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      curr[j] = v;
      if (v < rowMin) {
        rowMin = v;
      }
    }
    if (rowMin > max) {
      return max + 1;
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[bl]!;
}

function maxTypoDistance(termLength: number): number {
  if (termLength < 4) {
    return 0;
  }
  if (termLength >= 8) {
    return 2;
  }
  return 1;
}

function haystackWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * Exact word match, or (for longer tokens) a nearby dictionary word in the haystack
 * within a small edit distance — typo tolerance for storefront word search.
 */
function termMatchesHaystack(text: string, term: string): { hit: boolean; fuzzy: boolean } {
  if (containsTermAsWord(text, term)) {
    return { hit: true, fuzzy: false };
  }
  const t = term.trim().toLowerCase();
  const maxDist = maxTypoDistance(t.length);
  if (maxDist <= 0 || !text.trim()) {
    return { hit: false, fuzzy: false };
  }
  for (const word of haystackWords(text)) {
    if (Math.abs(word.length - t.length) > maxDist) {
      continue;
    }
    if (levenshteinDistance(word, t, maxDist) <= maxDist) {
      return { hit: true, fuzzy: true };
    }
  }
  return { hit: false, fuzzy: false };
}

function tokenMatchesAny(
  token: string,
  texts: readonly string[],
): { hit: boolean; fuzzy: boolean } {
  let fuzzyOnly = false;
  for (const text of texts) {
    const r = termMatchesHaystack(text, token);
    if (r.hit && !r.fuzzy) {
      return { hit: true, fuzzy: false };
    }
    if (r.hit && r.fuzzy) {
      fuzzyOnly = true;
    }
  }
  return { hit: fuzzyOnly, fuzzy: fuzzyOnly };
}

function scoreWordOrientedSearch(
  tokens: string[],
  fields: {
    name: string;
    stripped: string;
    category: string;
    slug: string;
    slugSegs: string[];
    description: string;
    supplier: string;
    colors: string;
    sizes: string;
    listingCode: string | null;
    parenCode: string | null;
  },
): number {
  const titleTexts = [fields.name, fields.stripped];
  const primaryTexts = [
    fields.name,
    fields.stripped,
    fields.category,
    fields.slug,
    ...fields.slugSegs,
    fields.supplier,
    fields.colors,
    fields.sizes,
  ];
  const codeExact = (token: string) =>
    (fields.listingCode != null && fields.listingCode.toLowerCase() === token) ||
    (fields.parenCode != null && fields.parenCode.toLowerCase() === token);

  let usedFuzzy = false;
  const primaryMatch = tokens.every((token) => {
    if (codeExact(token)) {
      return true;
    }
    const r = tokenMatchesAny(token, primaryTexts);
    if (r.hit && r.fuzzy) {
      usedFuzzy = true;
    }
    return r.hit;
  });

  if (primaryMatch) {
    let score = usedFuzzy ? 88 : 100;
    for (const token of tokens) {
      if (tokenMatchesAny(token, titleTexts).hit) {
        score += usedFuzzy ? 32 : 40;
      }
      if (termMatchesHaystack(fields.category, token).hit) {
        score += 15;
      }
      if (fields.supplier && termMatchesHaystack(fields.supplier, token).hit) {
        score += 12;
      }
      if (fields.colors && termMatchesHaystack(fields.colors, token).hit) {
        score += 10;
      }
      if (fields.sizes && termMatchesHaystack(fields.sizes, token).hit) {
        score += 8;
      }
    }
    return score;
  }

  if (fields.description.trim()) {
    const descMatch = tokens.every((token) => termMatchesHaystack(fields.description, token).hit);
    if (descMatch) {
      const descFuzzy = tokens.some((token) => termMatchesHaystack(fields.description, token).fuzzy);
      return descFuzzy ? 16 : 20;
    }
  }

  return 0;
}

function scoreStyleCodeOrientedSearch(
  q: string,
  qLower: string,
  compactQ: string,
  fields: {
    name: string;
    stripped: string;
    category: string;
    slug: string;
    description: string;
    supplier: string;
    colors: string;
    sizes: string;
    listingCode: string | null;
    productId: string;
  },
): number {
  const parts: string[] = [
    fields.name,
    fields.stripped,
    fields.category,
    fields.slug,
    fields.description,
    fields.supplier,
    fields.colors,
    fields.sizes,
    fields.productId,
  ];
  if (fields.listingCode) {
    parts.push(fields.listingCode);
  }
  for (const seg of slugSegments(fields.slug)) {
    parts.push(seg);
  }

  const haystack = parts.join(" ").toLowerCase();
  if (haystack.includes(qLower)) {
    return 80;
  }

  if (compactQ.length < 2) {
    return 0;
  }

  const blob = [
    fields.name,
    fields.stripped,
    fields.slug,
    fields.listingCode ?? "",
    fields.description,
    fields.supplier,
    fields.colors,
    fields.sizes,
    fields.productId,
  ]
    .join(" ")
    .toUpperCase();
  const compactBlob = compactUpper(blob);
  if (compactBlob.includes(compactQ)) {
    return 70;
  }

  if (matchesHiVisSynonym(compactQ, compactBlob)) {
    return 65;
  }

  const slugFlat = (fields.slug ?? "").toUpperCase().replace(/[-_]/g, "");
  return slugFlat.includes(compactQ) ? 60 : 0;
}

/**
 * Relevance score for storefront search (higher = better). `0` = no match.
 * Optional extras: supplier, colours, sizes (word + compact style-code paths).
 */
export function scoreProductSearchMatch(
  name: string,
  slug: string | null | undefined,
  category: string | null | undefined,
  rawQuery: string,
  description?: string | null,
  productId?: string | null,
  extras?: ProductSearchExtras,
): number {
  const q = rawQuery.trim();
  if (!q) {
    return 0;
  }

  const qLower = q.toLowerCase();
  const stripped = storefrontProductNameWithoutBrand(name);
  const listingCode = fashionBizStyleCodeFromListing(name, slug ?? null);
  const parenCode = trailingStyleCodeFromName(name);
  const slugStr = slug ?? "";
  const categoryStr = category ?? "";
  const descriptionStr = description ?? "";
  const productIdStr = productId?.trim() ?? "";
  const supplier = (extras?.supplierName ?? "").trim();
  const colors = joinListField(extras?.colors);
  const sizes = joinListField(extras?.sizes);

  const fields = {
    name,
    stripped,
    category: categoryStr,
    slug: slugStr,
    slugSegs: slugSegments(slugStr),
    description: descriptionStr,
    supplier,
    colors,
    sizes,
    listingCode,
    parenCode,
    productId: productIdStr,
  };

  if (isWordOrientedSearchQuery(q)) {
    const tokens = tokenizeSearchQuery(q);
    if (tokens.length === 0) {
      return 0;
    }
    return scoreWordOrientedSearch(tokens, fields);
  }

  const compactQ = compactUpper(q);
  return scoreStyleCodeOrientedSearch(q, qLower, compactQ, fields);
}

/**
 * Home / nav search: match product name, slug, category, description, style codes,
 * and optional supplier / colours / sizes (with light typo tolerance on word queries).
 */
export function productMatchesSearchQuery(
  name: string,
  slug: string | null | undefined,
  category: string | null | undefined,
  rawQuery: string,
  description?: string | null,
  productId?: string | null,
  extras?: ProductSearchExtras,
): boolean {
  return scoreProductSearchMatch(name, slug, category, rawQuery, description, productId, extras) > 0;
}

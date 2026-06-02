import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import { storefrontProductNameWithoutBrand } from "@/lib/product-display-name";

const TRAILING_STYLE_PAREN_RE = /\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/;

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

function scoreWordOrientedSearch(
  tokens: string[],
  fields: {
    name: string;
    stripped: string;
    category: string;
    slug: string;
    slugSegs: string[];
    description: string;
    listingCode: string | null;
    parenCode: string | null;
  },
): number {
  const primaryHay = [fields.name, fields.stripped, fields.category, fields.slug].join(" ");
  const primaryMatch = tokens.every(
    (token) =>
      containsTermAsWord(primaryHay, token) ||
      fields.slugSegs.some((seg) => seg.toLowerCase() === token || containsTermAsWord(seg, token)) ||
      (fields.listingCode != null && fields.listingCode.toLowerCase() === token) ||
      (fields.parenCode != null && fields.parenCode.toLowerCase() === token),
  );
  if (primaryMatch) {
    let score = 100;
    for (const token of tokens) {
      if (containsTermAsWord(fields.name, token) || containsTermAsWord(fields.stripped, token)) {
        score += 40;
      }
      if (containsTermAsWord(fields.category, token)) {
        score += 15;
      }
    }
    return score;
  }

  if (fields.description.trim()) {
    const descMatch = tokens.every((token) => containsTermAsWord(fields.description, token));
    if (descMatch) {
      return 20;
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

  const blob = [fields.name, fields.stripped, fields.slug, fields.listingCode ?? "", fields.description, fields.productId]
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
 */
export function scoreProductSearchMatch(
  name: string,
  slug: string | null | undefined,
  category: string | null | undefined,
  rawQuery: string,
  description?: string | null,
  productId?: string | null,
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

  const fields = {
    name,
    stripped,
    category: categoryStr,
    slug: slugStr,
    slugSegs: slugSegments(slugStr),
    description: descriptionStr,
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
 * Home / nav search: match product `name`, URL `slug` segments, DB `category` / `description`,
 * Fashion Biz style code from name/slug, and brand-stripped display tail (e.g. `Syzmik ZH145` → `ZH145`).
 */
export function productMatchesSearchQuery(
  name: string,
  slug: string | null | undefined,
  category: string | null | undefined,
  rawQuery: string,
  description?: string | null,
  productId?: string | null,
): boolean {
  return scoreProductSearchMatch(name, slug, category, rawQuery, description, productId) > 0;
}

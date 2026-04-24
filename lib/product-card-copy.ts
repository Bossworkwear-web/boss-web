import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import {
  storefrontDescriptionForDisplay,
  storefrontStripSupplierBranding,
} from "@/lib/product-display-name";
import { BIZ_CARE_COLLECTION_STYLE_MARKETING_TITLE } from "@/lib/biz-care-collection-style-titles.generated";
import { SYZMIK_STYLE_MARKETING_TITLE } from "@/lib/syzmik-style-titles.generated";

export type ProductCardDisplay = {
  /** CSV / description marketing title (e.g. Mens Striker Short Sleeve Polo). */
  productName: string | null;
  /** Style / SKU code (e.g. ZH145), always shown under the title when a title exists. */
  productCode: string;
};

/**
 * Internal supplier / CSV ledger fragment (e.g. `SG319M — catalog (02 Tees).`).
 * Uses `\\p{Pd}` so tight `SG319M—catalog` and en/em dash variants still match.
 */
const CATALOG_LEDGER_FRAGMENT_RE =
  /[A-Za-z0-9][A-Za-z0-9._/-]{0,48}\s*\p{Pd}\s*catalog\s*\([^)]+\)\.?/giu;

const CATALOG_LEDGER_FULL_LINE_RE =
  /^\s*[A-Za-z0-9][A-Za-z0-9._/-]{0,48}\s*\p{Pd}\s*catalog\s*\([^)]+\)\.?\s*$/iu;

/** Trailing `(5CCP1)` on `JB's Wear … (CODE)` listing titles. */
const TRAILING_STYLE_PAREN_RE = /\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/;

/**
 * `jb-6rkb` or a composite storefront slug whose catalog segment ends with `-jb-…`
 * (category browse must match the same rule as `/products/[slug]`).
 */
function jbCatalogSubslug(slug: string): string | null {
  const s = slug.trim().toLowerCase();
  if (!s) {
    return null;
  }
  const atEnd = /(?:^|-)(jb-[a-z0-9][a-z0-9_-]*)$/i.exec(s);
  if (atEnd) {
    return atEnd[1].toLowerCase();
  }
  const anywhere = /(?:^|-)(jb-[a-z0-9][a-z0-9_-]*)/i.exec(s);
  return anywhere ? anywhere[1].toLowerCase() : null;
}

function jbStyleCodeFromSlug(storeSlug: string): string | null {
  const seg = jbCatalogSubslug(storeSlug);
  if (!seg) {
    return null;
  }
  const m = /^jb-(.+)$/.exec(seg);
  if (!m) {
    return null;
  }
  const parts = m[1].split("-").filter(Boolean);
  const tail = parts.length ? parts[parts.length - 1] : "";
  if (/^[a-z0-9]{3,20}$/i.test(tail)) {
    return tail.toUpperCase();
  }
  return null;
}

function jbSupplierNameMatch(s: string | null | undefined): boolean {
  const t = String(s ?? "").trim().toLowerCase();
  return (
    t === "jb's wear" ||
    t === "jbs wear" ||
    t === "jbswear" ||
    /\bjbs\s*wear\b/i.test(t)
  );
}

function bisleySupplierNameMatch(s: string | null | undefined): boolean {
  return String(s ?? "").trim().toLowerCase().includes("bisley");
}

function isBisleyListingContext(
  storeSlug?: string | null,
  supplierName?: string | null,
  listingName?: string | null,
): boolean {
  const sl = String(storeSlug ?? "").trim().toLowerCase();
  if (sl.startsWith("bis-") || /\bbisley\b/.test(sl)) {
    return true;
  }
  if (bisleySupplierNameMatch(supplierName)) {
    return true;
  }
  return /^\s*bisley\s+/i.test(String(listingName ?? "").trim());
}

function isJbWearListingContext(
  storeSlug?: string | null,
  supplierName?: string | null,
  listingName?: string | null,
): boolean {
  if (jbCatalogSubslug(String(storeSlug ?? "").trim())) {
    return true;
  }
  const sl = String(storeSlug ?? "").trim().toLowerCase();
  if (sl.includes("jbswear")) {
    return true;
  }
  if (jbSupplierNameMatch(supplierName)) {
    return true;
  }
  if (/^jb'?s\s+wear\b/i.test(String(listingName ?? "").trim())) {
    return true;
  }
  return false;
}

/** Supplier copy that is fabric / pack bullets — not a storefront marketing title. */
function looksLikeJbFabricOrSpecMarketingLine(line: string): boolean {
  const t = line.trim();
  if (!t) {
    return false;
  }
  if (/^more\s+info:/i.test(t)) {
    return true;
  }
  if (/^https?:\/\//i.test(t)) {
    return true;
  }
  if (/^\d+%\s+[A-Za-z]/.test(t)) {
    return true;
  }
  if (/\|\s*one size fits/i.test(t)) {
    return true;
  }
  if (/\|\s*pack with hanging/i.test(t)) {
    return true;
  }
  if (/\b(polyester|cotton|elastane|nylon|fleece|jersey)\b/i.test(t) && /\d+%/.test(t)) {
    return true;
  }
  return false;
}

function jbWearNormalizeTitleCase(s: string): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => {
      if (/^jb'?s$/i.test(w)) {
        return "JB's";
      }
      const lower = w.toLowerCase();
      if (i > 0 && ["and", "with", "for", "of", "the", "in", "on", "to"].includes(lower)) {
        return lower;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * JB's Wear: `products.name` holds the listing title (e.g. `JB's KNITTED BEANIE CAMO (6RKB)`).
 * Do not prefer `description` fabric bullets over this — fixes PPE / Head Wear cards.
 */
function jbStripTrailingStyleParenFromTitle(raw: string, codeKey: string): string {
  const t = raw.trim();
  const m = t.match(TRAILING_STYLE_PAREN_RE);
  if (!m) {
    return t;
  }
  const inner = m[1].toUpperCase();
  if (inner === codeKey || /^[A-Z0-9][A-Z0-9/_-]{2,12}$/i.test(m[1])) {
    return t.slice(0, m.index).trim();
  }
  return t;
}

function jbWearCardTitleFromName(name: string, codeKey: string): string | null {
  const raw = name.trim();
  if (!raw) {
    return null;
  }
  let s = jbStripTrailingStyleParenFromTitle(raw, codeKey);
  s = storefrontStripSupplierBranding(s).trim();
  if (!s) {
    return null;
  }
  if (looksLikeJbFabricOrSpecMarketingLine(s) || s.length > 130) {
    return null;
  }
  return jbWearNormalizeTitleCase(s);
}

/** Bisley CSV titles: `Bisley … (B71407)` — headline without trailing style paren (code row uses `cardProductCode`). */
function bisleyCardTitleFromName(name: string, codeKey: string): string | null {
  const raw = name.trim();
  if (!raw) {
    return null;
  }
  let s = jbStripTrailingStyleParenFromTitle(raw, codeKey);
  s = storefrontStripSupplierBranding(s).trim();
  if (!s) {
    return null;
  }
  if (s.length > 130) {
    return null;
  }
  return s;
}

const JB_SUFFIX_STRIP_MIN_TITLE_WORDS = 2;

function jbNormWordForMatch(w: string): string {
  return w
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** Longest-first token list so alternation prefers `XXL` over `XL` and `XS` over `S`. */
const JB_STANDARD_SIZE_TAIL_ALT =
  "XXS|2XS|XS|XXL|2XL|XXXL|3XL|4XL|5XL|6XL|7XL|8XL|9XL|10XL|\\d+XL|XL|L|M|S|OSFM|OSFA|O\\/S|O\\s*/\\s*S|OS|FRE|ONE\\s*SIZE";

/**
 * Drop a trailing segment that matches one of `options` (longest match first).
 * Allows a space, ` - `, `|`, or `/` before the option (supplier CSV mixes these).
 */
function jbStripListedSuffixFlexible(
  title: string,
  options: readonly string[] | null | undefined,
  minWordsInTitle: number,
): string {
  const t = title.trim();
  const opts = (options ?? []).map((c) => String(c).trim()).filter((c) => c.length > 0);
  if (!t || opts.length === 0) {
    return t;
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < minWordsInTitle) {
    return t;
  }

  const sorted = [...opts].sort((a, b) => b.length - a.length);
  for (const c of sorted) {
    const pat = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const res = [
      new RegExp(`(?:\\s+|\\s*[-–|/]\\s+)${pat}\\s*$`, "i"),
      new RegExp(`(?:\\s+${pat})$`, "i"),
    ];
    for (const re of res) {
      if (re.test(t)) {
        const next = t.replace(re, "").trim();
        if (next.length > 0) {
          return next;
        }
      }
    }
  }
  return t;
}

/**
 * When the listing title ends with the same colour / size phrase as the PDP options but with different
 * spacing or hyphens (e.g. `Stone Grey` vs option `Stone-Grey`), peel trailing words by phrase match.
 */
function jbStripTrailingListedPhrasesAsWords(
  title: string,
  options: readonly string[] | null | undefined,
  minWordsRemain: number,
): string {
  let words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= minWordsRemain) {
    return title.trim();
  }

  const phrases: string[][] = [];
  for (const raw of options ?? []) {
    const s = String(raw).trim();
    if (!s) {
      continue;
    }
    for (const chunk of s.split(/[/|]+/g).map((p) => p.trim()).filter(Boolean)) {
      const pw = chunk.split(/[\s–—-]+/g).map((w) => w.trim()).filter(Boolean);
      if (pw.length > 0) {
        phrases.push(pw);
      }
    }
  }
  const sorted = [...phrases].sort((a, b) => b.length - a.length);

  let changed = true;
  while (changed && words.length > minWordsRemain) {
    changed = false;
    for (const phrase of sorted) {
      if (phrase.length === 0 || phrase.length > words.length) {
        continue;
      }
      if (phrase.length === 1 && /^\d+$/.test(phrase[0] ?? "")) {
        continue;
      }
      let ok = true;
      for (let i = 0; i < phrase.length; i++) {
        const tw = words[words.length - phrase.length + i] ?? "";
        const pw = phrase[i] ?? "";
        if (jbNormWordForMatch(tw) !== jbNormWordForMatch(pw)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        words = words.slice(0, -phrase.length);
        changed = true;
        break;
      }
    }
  }
  return words.join(" ").trim();
}

/** `Name | Colour | Size` (and similar) — keep the style name only. */
function jbStripLeadingSegmentBeforePipes(title: string): string {
  const t = title.trim();
  if (!t.includes("|")) {
    return t;
  }
  const parts = t.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return parts[0] ?? t;
  }
  if (parts.length === 2) {
    const tail = parts[1] ?? "";
    const tailWords = tail.split(/\s+/).filter(Boolean);
    const sizeRe = new RegExp(`^(?:${JB_STANDARD_SIZE_TAIL_ALT})$`, "i");
    const tailLooksSizeOnly =
      (tailWords.length === 1 && sizeRe.test(tailWords[0]!.replace(/\s+/g, ""))) ||
      (tailWords.length === 2 &&
        /^(?:size|sz)$/i.test(tailWords[0] ?? "") &&
        /^\d{1,3}$/.test(tailWords[1] ?? ""));
    if (tailLooksSizeOnly || tailWords.length <= 2) {
      return parts[0] ?? t;
    }
  }
  return t;
}

/**
 * JB CSV titles often append size after colour; grids may not pass `available_sizes`.
 * Strip trailing apparel size tokens (after whitespace or `-` / `|` / `/`).
 */
function jbStripStandardTrailingApparelSize(title: string): string {
  const t = title.trim();
  if (!t) {
    return t;
  }
  const re = new RegExp(`(?:\\s*[-–|/]\\s*|\\s+)(?:${JB_STANDARD_SIZE_TAIL_ALT})\\s*$`, "i");
  const next = t.replace(re, "").trim();
  return next.length > 0 ? next : t;
}

function jbStripAllStandardTrailingSizes(title: string): string {
  let t = title.trim();
  let prev = "";
  let guard = 0;
  while (t !== prev && guard < 8) {
    prev = t;
    t = jbStripStandardTrailingApparelSize(t);
    guard += 1;
  }
  return t;
}

function jbWearSanitizeDisplayTitle(
  title: string,
  colorOptions?: readonly string[] | null,
  sizeOptions?: readonly string[] | null,
): string {
  let t = title.trim();
  if (!t) {
    return t;
  }
  const minW = JB_SUFFIX_STRIP_MIN_TITLE_WORDS;

  t = jbStripLeadingSegmentBeforePipes(t);

  t = jbStripListedSuffixFlexible(t, sizeOptions, minW);
  t = jbStripTrailingListedPhrasesAsWords(t, sizeOptions, 1);
  t = jbStripAllStandardTrailingSizes(t);
  t = jbStripListedSuffixFlexible(t, colorOptions, minW);
  t = jbStripTrailingListedPhrasesAsWords(t, colorOptions, 1);

  t = jbStripListedSuffixFlexible(t, sizeOptions, minW);
  t = jbStripTrailingListedPhrasesAsWords(t, sizeOptions, 1);
  t = jbStripAllStandardTrailingSizes(t);
  t = jbStripListedSuffixFlexible(t, colorOptions, minW);
  t = jbStripTrailingListedPhrasesAsWords(t, colorOptions, 1);

  return t;
}

/**
 * Category / subcategory cards: short line from `products.name` only (no `description` body as headline).
 */
function browseListingTitleFromName(name: string, productCode: string): string | null {
  let raw = String(name ?? "").trim();
  if (!raw) {
    return null;
  }
  raw = raw.split(/\r?\n/)[0].trim();
  const codeKey = productCode.toUpperCase();
  const m = raw.match(TRAILING_STYLE_PAREN_RE);
  if (m && (m[1].toUpperCase() === codeKey || /^[A-Z0-9][A-Z0-9/_-]{2,12}$/i.test(m[1]))) {
    raw = raw.slice(0, m.index).trim();
  }
  const s = storefrontStripSupplierBranding(raw).trim();
  if (!s) {
    return null;
  }
  if (looksLikeJbFabricOrSpecMarketingLine(s)) {
    return null;
  }
  if (s.length > 110) {
    const cut = s.slice(0, 98).replace(/\s+\S*$/, "").trim();
    return cut.length > 0 ? cut : null;
  }
  return s;
}

function isCatalogBoilerplate(s: string): boolean {
  const t = s.trim();
  if (!t) {
    return false;
  }
  if (CATALOG_LEDGER_FULL_LINE_RE.test(t)) {
    return true;
  }
  const withoutLedger = t.replace(CATALOG_LEDGER_FRAGMENT_RE, "").replace(/\s+/g, " ").trim();
  return withoutLedger.length === 0;
}

/** Remove catalog metadata lines / paragraphs from description body (PDP). */
function stripCatalogMetadataFromBody(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  const paragraphs = trimmed.split(/\n\s*\n/);
  const kept: string[] = [];
  for (const para of paragraphs) {
    const lines = para.split(/\r?\n/).map((l) => l.trimEnd());
    const keptLines = lines
      .map((line) => {
        let t = line.trim();
        if (!t) {
          return "";
        }
        t = t.replace(CATALOG_LEDGER_FRAGMENT_RE, " ").replace(/\s+/g, " ").trim();
        return t;
      })
      .filter((line) => line.length > 0 && !isCatalogBoilerplate(line));
    if (keptLines.length > 0) {
      kept.push(keptLines.join("\n"));
    }
  }
  return kept.join("\n\n").trim();
}

function cardProductCode(
  name: string,
  storeSlug?: string | null,
  supplierName?: string | null,
): string {
  const fromListing = fashionBizStyleCodeFromListing(name, storeSlug ?? null);
  if (fromListing) {
    return fromListing;
  }
  const slug = (storeSlug ?? "").trim();
  if (jbCatalogSubslug(slug)) {
    const fromSlug = jbStyleCodeFromSlug(slug);
    if (fromSlug) {
      return fromSlug;
    }
  }
  if (/^jb'?s\s+wear\b/i.test(name.trim())) {
    const m = name.trim().match(TRAILING_STYLE_PAREN_RE);
    if (m) {
      return m[1].toUpperCase();
    }
  }
  if (jbSupplierNameMatch(supplierName)) {
    const m = name.trim().match(TRAILING_STYLE_PAREN_RE);
    if (m) {
      return m[1].toUpperCase();
    }
  }
  if (isBisleyListingContext(storeSlug, supplierName, name)) {
    const m = name.trim().match(TRAILING_STYLE_PAREN_RE);
    if (m) {
      return m[1].toUpperCase();
    }
  }
  const stripped = storefrontStripSupplierBranding(name).trim();
  return stripped.length > 0 ? stripped : name.trim();
}

/** `Brand SKU — … catalog (section).` supplier template — not a card title. */
function isSupplierCatalogTemplateLine(line: string): boolean {
  return /[—–\u2013\u2014]\s*.+\bcatalog\s*\([^)]+\)/i.test(line);
}

function cardMarketingTitleFromDescription(
  raw: string,
  name: string,
  codeKey: string,
): string | null {
  const paragraphs = raw
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const lines: string[] = [];
  for (const para of paragraphs.slice(0, 4)) {
    for (const line of para.split(/\r?\n/).map((l) => l.trim())) {
      if (line.length > 0) {
        lines.push(line);
      }
    }
  }

  const nameStripped = storefrontStripSupplierBranding(name);
  for (const line of lines) {
    if (line === name.trim() || isCatalogBoilerplate(line) || isSupplierCatalogTemplateLine(line)) {
      continue;
    }
    if (looksLikeJbFabricOrSpecMarketingLine(line)) {
      continue;
    }
    const cleanedTitle = storefrontStripSupplierBranding(line);
    if (!cleanedTitle) {
      continue;
    }
    if (cleanedTitle.toUpperCase() === codeKey) {
      continue;
    }
    if (storefrontStripSupplierBranding(line) === nameStripped) {
      continue;
    }
    if (isCatalogBoilerplate(cleanedTitle)) {
      continue;
    }
    return cleanedTitle;
  }
  return null;
}

function isSyzmikProductListing(name: string, storeSlug?: string | null): boolean {
  if (/^\s*syzmik\s+/i.test(name.trim())) {
    return true;
  }
  return /\bsyzmik\b/i.test((storeSlug ?? "").toLowerCase());
}

function syzmikMarketingTitleFallback(
  name: string,
  codeKey: string,
  storeSlug?: string | null,
): string | null {
  if (!isSyzmikProductListing(name, storeSlug)) {
    return null;
  }
  const baseKey = codeKey.replace(/-CLEARANCE$/i, "");
  const fromCsv =
    SYZMIK_STYLE_MARKETING_TITLE[codeKey] ?? SYZMIK_STYLE_MARKETING_TITLE[baseKey];
  if (!fromCsv?.trim()) {
    return null;
  }
  const cleaned = storefrontStripSupplierBranding(fromCsv.trim());
  return cleaned.length > 0 ? cleaned : fromCsv.trim();
}

function isFashionBizCareOrCollectionListing(
  name: string,
  storeSlug?: string | null,
  supplierName?: string | null,
): boolean {
  if (fashionBizStyleCodeFromListing(name, storeSlug)) {
    return true;
  }
  const sup = String(supplierName ?? "").trim().toLowerCase();
  return sup === "biz care" || sup === "biz collection";
}

/** Biz Care / Biz Collection sum.csv `short_description` when `products.name` is only `Brand {STYLE}`. */
function bizCareCollectionMarketingTitleFallback(
  name: string,
  codeKey: string,
  storeSlug?: string | null,
  supplierName?: string | null,
): string | null {
  if (!isFashionBizCareOrCollectionListing(name, storeSlug, supplierName)) {
    return null;
  }
  const baseKey = codeKey.replace(/-CLEARANCE$/i, "");
  const fromCsv =
    BIZ_CARE_COLLECTION_STYLE_MARKETING_TITLE[codeKey] ??
    BIZ_CARE_COLLECTION_STYLE_MARKETING_TITLE[baseKey];
  if (!fromCsv?.trim()) {
    return null;
  }
  const cleaned = storefrontStripSupplierBranding(fromCsv.trim());
  return cleaned.length > 0 ? cleaned : fromCsv.trim();
}

/**
 * Category grid: product name above, style code below.
 * PDP (`forStorefrontBrowseGrid` false) may still use `description` for Fashion Biz–style marketing titles.
 */
export function productCardDisplayLines(
  name: string,
  description: string | null | undefined,
  storeSlug?: string | null,
  supplierName?: string | null,
  /** Pass `available_colors` on grids / PDP so JB headlines do not repeat a trailing colour token (e.g. `… Beanie Camo`). */
  availableColorsForJbTitle?: readonly string[] | null,
  /** Category & subcategory browse: never use `description` as the card title — only listing name + JB/Syzmik helpers. */
  forStorefrontBrowseGrid?: boolean,
  /** Pass `available_sizes` when known so JB titles do not repeat a trailing size token (e.g. `… Navy 2XL`). */
  availableSizesForJbTitle?: readonly string[] | null,
): ProductCardDisplay {
  const productCode = cardProductCode(name, storeSlug, supplierName);
  const codeKey = productCode.toUpperCase();

  const raw = (description ?? "").trim();
  let productName: string | null = null;
  if (isJbWearListingContext(storeSlug, supplierName, name)) {
    productName = jbWearCardTitleFromName(name, codeKey);
  }
  if (!productName) {
    productName = syzmikMarketingTitleFallback(name, codeKey, storeSlug);
  }
  if (!productName) {
    productName = bizCareCollectionMarketingTitleFallback(name, codeKey, storeSlug, supplierName);
  }
  /**
   * Category grids normally avoid `description` (stable card titles from `products.name`).
   * Fashion Biz rows are often `Biz Care {STYLE}` only — stripping the brand leaves a bare SKU in the title slot.
   * Use the CSV marketing line from `description` on browse grids for those listings (e.g. Health care / Biz Care).
   */
  const fashionBizStyle = fashionBizStyleCodeFromListing(name, storeSlug);
  const useDescriptionTitleOnBrowseGrid = Boolean(
    forStorefrontBrowseGrid &&
      (fashionBizStyle || isFashionBizCareOrCollectionListing(name, storeSlug, supplierName)),
  );
  if (!productName && raw.length > 0 && (!forStorefrontBrowseGrid || useDescriptionTitleOnBrowseGrid)) {
    productName = cardMarketingTitleFromDescription(raw, name, codeKey);
  }
  if (!productName && isBisleyListingContext(storeSlug, supplierName, name)) {
    productName = bisleyCardTitleFromName(name, codeKey);
  }
  if (!productName && forStorefrontBrowseGrid) {
    productName = browseListingTitleFromName(name, productCode);
  }

  if (productName && isJbWearListingContext(storeSlug, supplierName, name)) {
    productName = jbWearSanitizeDisplayTitle(
      productName,
      availableColorsForJbTitle,
      availableSizesForJbTitle,
    );
  }

  return { productName, productCode };
}

/**
 * Product detail: description copy without repeating the marketing title block (first paragraph).
 */
export function productDetailDescriptionBody(
  description: string | null | undefined,
  productName: string | null,
): string {
  const body = description == null || !String(description).trim() ? "" : String(description).trim();
  if (!body) {
    return "";
  }
  const cleaned = storefrontDescriptionForDisplay(body);
  if (!productName?.trim()) {
    return stripCatalogMetadataFromBody(cleaned);
  }
  const paras = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) {
    return stripCatalogMetadataFromBody(cleaned);
  }
  const firstParaLines = paras[0].split(/\r?\n/);
  const firstLine = firstParaLines[0]?.trim() ?? "";
  if (
    firstLine &&
    storefrontStripSupplierBranding(firstLine).toLowerCase() === productName.trim().toLowerCase()
  ) {
    const firstParaAfterTitle = firstParaLines.slice(1).join("\n").trim();
    const rest = [firstParaAfterTitle, ...paras.slice(1)].filter((s) => s.length > 0).join("\n\n");
    let out = stripCatalogMetadataFromBody(rest);
    if (out.trim().length > 0) {
      return out;
    }
    // First block only repeated the PDP headline (or stripping removed catalog junk) — use later paragraphs.
    if (paras.length > 1) {
      out = stripCatalogMetadataFromBody(paras.slice(1).join("\n\n"));
      if (out.trim().length > 0) {
        return out;
      }
    }
    // Avoid an empty PDP when the DB only had the title line or metadata left nothing after dedupe.
    const fullBody = stripCatalogMetadataFromBody(cleaned);
    return fullBody.trim().length > 0 ? fullBody : "";
  }
  return stripCatalogMetadataFromBody(cleaned);
}

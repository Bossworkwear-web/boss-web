import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import {
  storefrontDescriptionForDisplay,
  storefrontProductNameWithoutBrand,
  storefrontStripSupplierBranding,
} from "@/lib/product-display-name";
import { BIZ_CARE_COLLECTION_STYLE_DETAIL_BODY } from "@/lib/biz-care-collection-style-details.generated";
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

function dncSupplierNameMatch(s: string | null | undefined): boolean {
  const t = String(s ?? "").trim().toLowerCase();
  return t === "dnc" || t === "dnc workwear" || /\bdnc\s*workwear\b/i.test(t);
}

function isDncListingContext(
  storeSlug?: string | null,
  supplierName?: string | null,
  listingName?: string | null,
): boolean {
  const sl = String(storeSlug ?? "").trim().toLowerCase();
  if (sl.startsWith("dnc-")) {
    return true;
  }
  if (dncSupplierNameMatch(supplierName)) {
    return true;
  }
  return /^\s*dnc\s+/i.test(String(listingName ?? "").trim());
}

function headwearSupplierNameMatch(s?: string | null): boolean {
  const t = String(s ?? "").trim().toLowerCase();
  return t === "headwear" || t === "head wear";
}

function isHeadwearListingContext(
  storeSlug?: string | null,
  supplierName?: string | null,
  category?: string | null,
): boolean {
  const cat = String(category ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (cat === "head wear" || cat === "headwear") {
    return true;
  }
  const sl = String(storeSlug ?? "").trim().toLowerCase();
  if (sl.startsWith("hw-")) {
    return true;
  }
  return headwearSupplierNameMatch(supplierName);
}

/** Xada sync descriptions start with `Style:` + `Categories: Headwear …`. */
function descriptionLooksLikeHeadwearSync(text: string): boolean {
  const t = text.trim();
  if (!t) {
    return false;
  }
  return /^style\s*:\s*.+/im.test(t) && /^categories\s*:\s*headwear/im.test(t);
}

/** Headwear PDP / cards: style code from sync `Style: 3060` line in `description`. */
export function headwearStyleCodeFromDescription(description: string | null | undefined): string | null {
  for (const line of String(description ?? "").split(/\r?\n/)) {
    const m = line.trim().match(/^style\s*:\s*(.+)$/i);
    if (m?.[1]) {
      const code = m[1].trim();
      if (code) {
        return code.toUpperCase();
      }
    }
  }
  return null;
}

/** Headwear Xada sync: style code from `Style:` line, else slug `hw-4590` → `4590`. */
function headwearStyleCodeFromListing(
  storeSlug?: string | null,
  supplierName?: string | null,
  description?: string | null,
  category?: string | null,
): string | null {
  if (!isHeadwearListingContext(storeSlug, supplierName, category)) {
    return null;
  }
  const fromDesc = headwearStyleCodeFromDescription(description);
  if (fromDesc) {
    return fromDesc;
  }
  const slug = String(storeSlug ?? "").trim().toLowerCase();
  const slugM = /^hw-([a-z0-9][a-z0-9-]*)$/i.exec(slug);
  if (slugM?.[1]) {
    return slugM[1].toUpperCase();
  }
  return null;
}

/**
 * Headwear PDP headline + style code — never use `Categories:` metadata as the title.
 * Prefer `products.name` for title and `Style:` from description for the code (user-facing product ID).
 */
export function headwearPdpDisplayOverride(
  name: string,
  description: string | null | undefined,
  storeSlug?: string | null,
  supplierName?: string | null,
  category?: string | null,
): ProductCardDisplay | null {
  const raw = (description ?? "").trim();
  if (
    !isHeadwearListingContext(storeSlug, supplierName, category) &&
    !descriptionLooksLikeHeadwearSync(raw)
  ) {
    return null;
  }
  const rawLine = String(name ?? "").trim().split(/\r?\n/)[0]?.trim() ?? "";
  let productName =
    rawLine.length > 0 && !/^categories\s*:/i.test(rawLine) ? rawLine : null;
  if (!productName && raw) {
    const body = stripHeadwearStructuredMetaLines(raw);
    const firstPara = body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)[0] ?? "";
    const firstLine = firstPara.split(/\r?\n/)[0]?.trim() ?? "";
    if (
      firstLine &&
      !/^categories\s*:/i.test(firstLine) &&
      !/^style\s*:/i.test(firstLine) &&
      !/^brand\s*:/i.test(firstLine)
    ) {
      productName = firstLine;
    }
  }
  const productCode =
    headwearStyleCodeFromDescription(raw) ??
    headwearStyleCodeFromListing(storeSlug, supplierName, description, category) ??
    "";
  return {
    productName,
    productCode,
  };
}

/** DNC import: style code from trailing `(3718)` or slug `dnc-3718` — storefront shows digits when possible. */
function dncStyleCodeFromListing(
  name: string,
  storeSlug?: string | null,
  supplierName?: string | null,
): string | null {
  if (!isDncListingContext(storeSlug, supplierName, name)) {
    return null;
  }
  const trimmed = String(name ?? "").trim();
  const parenM = trimmed.match(TRAILING_STYLE_PAREN_RE);
  if (parenM?.[1]) {
    const token = parenM[1].trim();
    if (/^\d+$/.test(token)) {
      return token;
    }
    const digits = token.replace(/\D/g, "");
    return digits.length > 0 ? digits : token.toUpperCase();
  }
  const slug = String(storeSlug ?? "").trim().toLowerCase();
  const slugM = /^dnc-([a-z0-9]+)$/i.exec(slug);
  if (slugM?.[1]) {
    const token = slugM[1];
    if (/^\d+$/.test(token)) {
      return token;
    }
    const digits = token.replace(/\D/g, "");
    return digits.length > 0 ? digits : token.toUpperCase();
  }
  return null;
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

/** Bisley PDP: show `APEX` before the marketing title for these style codes. */
export const BISLEY_STYLE_CODES_APEX_TITLE_PREFIX = new Set(
  [
    "BS6156T",
    "BL8339T",
    "BC8479T",
    "BC8475T",
    "BCL8479T",
    "BCL8475T",
    "BC8478T",
    "BS8439T",
    "BL8439T",
    "BL8439XT",
  ].map((c) => c.toUpperCase()),
);

/**
 * PDP headline only — keep base `productName` for description dedupe / cart copy unless callers switch.
 */
export function bisleyPdpDisplayProductNameWithApexPrefix(
  productName: string | null,
  productCode: string,
  supplierName?: string | null,
  storeSlug?: string | null,
  listingName?: string | null,
): string | null {
  const base = productName?.trim() ?? "";
  if (!base) {
    return productName;
  }
  if (!isBisleyListingContext(storeSlug, supplierName, listingName)) {
    return productName;
  }
  const key = productCode.toUpperCase().replace(/-CLEARANCE$/i, "");
  if (!BISLEY_STYLE_CODES_APEX_TITLE_PREFIX.has(key)) {
    return productName;
  }
  if (/^apex\s+/i.test(base)) {
    return productName;
  }
  return `APEX ${base}`;
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

/**
 * JB's Wear XLSX copy uses `|` between spec phrases. Turn those into line breaks with `- ` bullets.
 * Preserves `More info:` lines and paragraphs that do not contain `|`.
 */
function jbWearFormatDescriptionPipesToBullets(body: string): string {
  if (!body.includes("|")) {
    return body;
  }
  return body
    .split(/\n\s*\n/)
    .map((para) => {
      const p = para.trim();
      if (!p) {
        return p;
      }
      const lines = p.split(/\r?\n/);
      const rebuilt: string[] = [];
      for (const line of lines) {
        const t = line.trim();
        if (!t) {
          continue;
        }
        if (/^more\s+info:/i.test(t)) {
          rebuilt.push(t);
          continue;
        }
        if (!t.includes("|")) {
          rebuilt.push(t);
          continue;
        }
        for (const part of t.split("|").map((s) => s.trim()).filter(Boolean)) {
          rebuilt.push(`- ${part}`);
        }
      }
      return rebuilt.join("\n");
    })
    .join("\n\n");
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

/** Hyphen-like chars in slugs (copy/paste / DB) so `ap–x` still matches `ap-` catalog prefix. */
function normalizeStoreSlugForCatalogPrefix(storeSlug?: string | null): string {
  return String(storeSlug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014\u2212]/g, "-");
}

function isAussiePacificStorefrontContext(supplierName?: string | null, storeSlug?: string | null): boolean {
  const sup = String(supplierName ?? "").trim().toLowerCase();
  const sl = normalizeStoreSlugForCatalogPrefix(storeSlug);
  return sup === "aussie pacific" || sl.startsWith("ap-");
}

/** When `supplier_name` is missing in the payload, slug checks can still fail — sync copy always includes this line. */
function descriptionHasAussiePacificSyncBrandLine(text: string): boolean {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }
    if (i > 60) {
      break;
    }
    if (/^brand\s*:\s*aussie\s*pacific\b/i.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * Aussie Pacific API/sync often prepends `Brand:`, `Style code:`, categories, `Size(s):`, `Product Description:` — remove for PDP body only.
 */
function stripAussiePacificStructuredMetaLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      kept.push(raw);
      continue;
    }
    const productDesc = line.match(/^product\s*description\s*:\s*(.*)$/i);
    if (productDesc) {
      const rest = productDesc[1].trim();
      if (rest) {
        kept.push(rest);
      }
      continue;
    }
    if (/^brand\s*:/i.test(line)) {
      continue;
    }
    if (/^style\s*code\s*:/i.test(line)) {
      continue;
    }
    if (/^main\s*category\s*:/i.test(line)) {
      continue;
    }
    if (/^sub\s*category\s*:/i.test(line)) {
      continue;
    }
    if (/^style\s*:/i.test(line)) {
      continue;
    }
    if (/^size\s*:/i.test(line)) {
      continue;
    }
    if (/^sizes\s*:/i.test(line)) {
      continue;
    }
    if (/^sizes\s*$/i.test(line)) {
      continue;
    }
    if (/^product\s*description\s*$/i.test(line)) {
      continue;
    }
    kept.push(raw);
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Headwear Xada sync prepends `Style:` / `Categories:` — remove for PDP body only. */
function stripHeadwearStructuredMetaLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      kept.push(raw);
      continue;
    }
    if (/^style\s*:/i.test(line)) {
      continue;
    }
    if (/^categories\s*:/i.test(line)) {
      continue;
    }
    kept.push(raw);
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Next section after a `Fabric:` block (do not tab-bullet these lines). */
const AUSSIE_PACIFIC_FABRIC_FOLLOWING_STOP = new RegExp(
  "^(?:(?:product\\s+|key\\s+)?features|care(?:\\s*instructions)?|washing|machine\\s*wash|instructions?|specification|specifications|" +
    "size|sizes|product\\s*description|dimensions|weight|details|composition|material|measurements|delivery|" +
    "included|packaging|note|notes|origin|colou?rs?|colou?r\\s*range)\\s*:",
  "i",
);

/**
 * After a `Fabric:` line, prefix each following line with a tab + `- ` until a new labelled section.
 */
function formatAussiePacificFabricContinuationLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let underFabric = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (/^fabric\s*:/i.test(trimmed)) {
      underFabric = true;
      out.push(raw);
      continue;
    }
    if (underFabric) {
      if (!trimmed) {
        out.push(raw);
        continue;
      }
      if (AUSSIE_PACIFIC_FABRIC_FOLLOWING_STOP.test(trimmed)) {
        underFabric = false;
        out.push(raw);
        continue;
      }
      const body = trimmed.replace(/^\t*\s*-\s+/, "");
      out.push(`\t- ${body}`);
      continue;
    }
    out.push(raw);
  }
  return out.join("\n");
}

/** Next section after a `Features:` block (catalog often lists plain lines under the label). */
const AUSSIE_PACIFIC_FEATURES_FOLLOWING_STOP = new RegExp(
  "^(fabric|(?:(?:product\\s+|key\\s+)?features)|care(?:\\s*instructions)?|washing|machine\\s*wash|instructions?|specification|specifications|" +
    "size|sizes|product\\s*description|dimensions|weight|details|composition|material|measurements|delivery|" +
    "included|packaging|note|notes|origin|colou?rs?|colou?r\\s*range|benefits|selling\\s*points)\\s*:",
  "i",
);

/**
 * After a `Features:` line, prefix each following line with a tab + `- ` until a new labelled section.
 */
function formatAussiePacificFeaturesContinuationLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let underFeatures = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    /** `Features:`, `Product Features:`, `Key Features:` (Aussie Pacific / HTML → plain text). */
    if (/^(?:product\s+|key\s+)?features\s*:/i.test(trimmed)) {
      underFeatures = true;
      out.push(raw);
      continue;
    }
    if (underFeatures) {
      if (!trimmed) {
        out.push(raw);
        continue;
      }
      if (AUSSIE_PACIFIC_FEATURES_FOLLOWING_STOP.test(trimmed)) {
        underFeatures = false;
        out.push(raw);
        continue;
      }
      const body = trimmed.replace(/^\t*\s*-\s+/, "");
      out.push(`\t- ${body}`);
      continue;
    }
    out.push(raw);
  }
  return out.join("\n");
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
  description?: string | null,
  category?: string | null,
): string {
  const sup = String(supplierName ?? "").trim().toLowerCase();
  const slugLower = String(storeSlug ?? "").trim().toLowerCase();
  const isBlueWhale = sup === "blue whale" || /^\s*blue\s*whale\b/i.test(name.trim());
  const isAussiePacific = sup === "aussie pacific" || slugLower.startsWith("ap-");
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
  if (isBlueWhale) {
    const m = name.trim().match(TRAILING_STYLE_PAREN_RE);
    if (m) {
      return m[1].toUpperCase();
    }
  }
  const dncCode = dncStyleCodeFromListing(name, storeSlug, supplierName);
  if (dncCode) {
    return dncCode;
  }
  const headwearCode = headwearStyleCodeFromListing(storeSlug, supplierName, description, category);
  if (headwearCode) {
    return headwearCode;
  }
  if (isAussiePacific) {
    // API names end with ` - W3307` / ` - W1907L` / etc.
    const m = name.trim().match(/\s-\s*([A-Za-z0-9]{2,14})\s*$/);
    const code = m?.[1]?.trim() ?? "";
    // Style codes are usually `W####` / `W####L` but can be alphanumeric without digits.
    if (code && (/^W[A-Z0-9]{1,12}$/i.test(code) || /\d/.test(code))) {
      const upper = code.toUpperCase();
      // Storefront display: drop the leading `W` prefix on style codes (e.g. `W3305` → `3305`).
      if (/^W[A-Z0-9]{1,12}$/.test(upper)) {
        return upper.slice(1);
      }
      return upper;
    }
  }
  const syzmikCode = syzmikStyleCodeFromListing(name, storeSlug, supplierName);
  if (syzmikCode) {
    return syzmikCode;
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
    const normalizedLine = line
      .replace(/^\uFEFF/g, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();
    // Aussie Pacific API sync prepends structured metadata lines (Brand / Style code / categories).
    // These must never become the PDP headline.
    if (/^brand\s*:/i.test(normalizedLine) || /^style\s*code\s*:/i.test(normalizedLine)) {
      continue;
    }
    if (/^main\s*category\s*:/i.test(normalizedLine) || /^sub\s*category\s*:/i.test(normalizedLine)) {
      continue;
    }
    if (/^style\s*:/i.test(normalizedLine)) {
      continue;
    }
    if (/^categories\s*:/i.test(normalizedLine)) {
      continue;
    }
    if (/^supplier:\s*https?:\/\//i.test(normalizedLine)) {
      continue;
    }
    if (normalizedLine === name.trim() || isCatalogBoilerplate(normalizedLine) || isSupplierCatalogTemplateLine(normalizedLine)) {
      continue;
    }
    if (looksLikeJbFabricOrSpecMarketingLine(normalizedLine)) {
      continue;
    }
    const cleanedTitle = storefrontStripSupplierBranding(normalizedLine);
    if (!cleanedTitle) {
      continue;
    }
    if (cleanedTitle.toUpperCase() === codeKey) {
      continue;
    }
    if (storefrontStripSupplierBranding(normalizedLine) === nameStripped) {
      continue;
    }
    if (isCatalogBoilerplate(cleanedTitle)) {
      continue;
    }
    return cleanedTitle;
  }
  return null;
}

function isSyzmikProductListing(
  name: string,
  storeSlug?: string | null,
  supplierName?: string | null,
): boolean {
  if (/^\s*syzmik\s+/i.test(name.trim())) {
    return true;
  }
  const sup = String(supplierName ?? "").trim().toLowerCase();
  if (sup === "syzmik" || sup.includes("syzmik")) {
    return true;
  }
  return /\bsyzmik\b/i.test((storeSlug ?? "").toLowerCase());
}

/** Syzmik style code from slug (`fb-syzmik-zj620-au`), `Syzmik ZJ620-AU`, or trailing `(ZJ620-AU)` on a title. */
export function syzmikStyleCodeFromListing(
  name: string,
  storeSlug?: string | null,
  supplierName?: string | null,
): string | null {
  if (!isSyzmikProductListing(name, storeSlug, supplierName)) {
    return null;
  }
  const slug = (storeSlug ?? "").trim().toLowerCase();
  const slugM =
    slug.match(/(?:^|-)fb-syzmik-([a-z0-9]+(?:-[a-z0-9]+)*)(?:-clearance)?(?:-|$)/i) ??
    slug.match(/(?:^|-)syzmik-([a-z0-9]+(?:-[a-z0-9]+)*)(?:-clearance)?(?:-|$)/i);
  if (slugM?.[1]) {
    return slugM[1].toUpperCase();
  }
  const trimmed = name.trim();
  const parenM = trimmed.match(TRAILING_STYLE_PAREN_RE);
  if (parenM?.[1] && /^Z[A-Z0-9]/i.test(parenM[1])) {
    return parenM[1].toUpperCase();
  }
  const afterBrand = storefrontProductNameWithoutBrand(trimmed);
  if (/^Z[A-Z0-9]{2,}(?:-[A-Z0-9]+)*$/i.test(afterBrand)) {
    return afterBrand.toUpperCase();
  }
  const head = afterBrand.split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z0-9-]/g, "") ?? "";
  if (/^Z[A-Z0-9]{2,}(?:-[A-Z0-9]+)*$/i.test(head)) {
    return head;
  }
  return null;
}

function syzmikMarketingTitleFallback(
  name: string,
  codeKey: string,
  storeSlug?: string | null,
  supplierName?: string | null,
): string | null {
  if (!isSyzmikProductListing(name, storeSlug, supplierName)) {
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
  category?: string | null,
): ProductCardDisplay {
  const productCode = cardProductCode(name, storeSlug, supplierName, description, category);
  const codeKey = productCode.toUpperCase();
  const sup = String(supplierName ?? "").trim().toLowerCase();
  const slugLower = String(storeSlug ?? "").trim().toLowerCase();
  const isBlueWhale = sup === "blue whale" || /^\s*blue\s*whale\b/i.test(name.trim());
  const isDnc = isDncListingContext(storeSlug, supplierName, name);
  const isAussiePacific = sup === "aussie pacific" || slugLower.startsWith("ap-");

  const raw = (description ?? "").trim();
  let productName: string | null = null;
  if (isAussiePacific) {
    // Storefront: show human name in title, keep style code as productCode.
    const line = String(name ?? "").trim().split(/\r?\n/)[0]?.trim() ?? "";
    const m = line.match(/\s-\s*([A-Za-z0-9]{2,14})\s*$/);
    const code = m?.[1]?.trim() ?? "";
    const head = m && m.index != null ? line.slice(0, m.index).trim() : line;
    const cleanedHead = head
      .replace(/^\s*Aussie\s+Pacific\s+/i, "")
      .replace(/^\s*AUSSIE\s+PACIFIC\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    productName = cleanedHead.length > 0 ? cleanedHead : null;
    // If the stored name is only the code, fallback to the codeKey cleanup.
    if (productName && code && productName.toUpperCase() === code.toUpperCase()) {
      productName = null;
    }
    // Do not return early: allow safe fallbacks if the listing name is malformed.
  }
  // Blue Whale rows include rich descriptions; never use description as the headline.
  if (isBlueWhale) {
    productName = browseListingTitleFromName(name, productCode);
    if (!productName) {
      // Hard fallback: strip supplier branding + trailing style parens from the stored name.
      const rawLine = String(name ?? "").trim().split(/\r?\n/)[0]?.trim() ?? "";
      const m = rawLine.match(TRAILING_STYLE_PAREN_RE);
      const withoutParens = m ? rawLine.slice(0, m.index).trim() : rawLine;
      const stripped = storefrontStripSupplierBranding(withoutParens).trim();
      productName = stripped.length > 0 ? stripped : null;
    }
    return { productName, productCode };
  }
  // DNC: `description` may only hold a supplier URL — headline always comes from `products.name`.
  if (isDnc) {
    productName = browseListingTitleFromName(name, productCode);
    if (!productName) {
      const rawLine = String(name ?? "").trim().split(/\r?\n/)[0]?.trim() ?? "";
      const m = rawLine.match(TRAILING_STYLE_PAREN_RE);
      const withoutParens = m ? rawLine.slice(0, m.index).trim() : rawLine;
      const stripped = storefrontStripSupplierBranding(withoutParens).trim();
      productName = stripped.length > 0 ? stripped : null;
    }
    return { productName, productCode };
  }
  const headwearDisplay = headwearPdpDisplayOverride(name, description, storeSlug, supplierName, category);
  if (headwearDisplay) {
    return headwearDisplay;
  }
  if (isJbWearListingContext(storeSlug, supplierName, name)) {
    productName = jbWearCardTitleFromName(name, codeKey);
  }
  if (!productName) {
    productName = syzmikMarketingTitleFallback(name, codeKey, storeSlug, supplierName);
  }
  if (!productName) {
    productName = bizCareCollectionMarketingTitleFallback(name, codeKey, storeSlug, supplierName);
  }
  // Bisley PDP/cards: always prefer the stored listing name as the headline.
  // Bisley descriptions are rich body copy, not a marketing-title line.
  if (!productName && isBisleyListingContext(storeSlug, supplierName, name)) {
    productName = bisleyCardTitleFromName(name, codeKey);
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

/** Biz Collection, Biz Care, Yes Chef — sum CSV `stringified_description` PDP layout (semicolon rows, feature bullets). */
function isFashionBizSumCsvStorefrontListing(
  supplierName?: string | null,
  listingName?: string | null,
): boolean {
  const sup = String(supplierName ?? "").trim().toLowerCase();
  if (sup === "biz collection" || sup === "biz care" || sup === "yes chef") {
    return true;
  }
  const listing = String(listingName ?? "").trim();
  return (
    /\bbiz collection\b/i.test(listing) ||
    /\bbiz care\b/i.test(listing) ||
    /\byes\s*chef\b/i.test(listing)
  );
}

/**
 * Sum CSV bodies use `;` between Sizes / Fabric / Features — split only on those boundaries so
 * Fabric specs like `…Elastane; Mid-weight Twill; 215 GSM` stay on one line for comma bullets.
 */
function fashionBizBreakSemicolonsToLines(s: string): string {
  const text = s.trim();
  if (!text.includes(";")) {
    return text;
  }
  const lines: string[] = [];
  const featuresMatch = /;\s*(Features:)/i.exec(text);
  const beforeFeatures = featuresMatch ? text.slice(0, featuresMatch.index).trim() : text;
  const featuresPart = featuresMatch
    ? `${featuresMatch[1]}${text.slice(featuresMatch.index + featuresMatch[0].length)}`.trim()
    : "";

  const fabricMatch = /;\s*(Fabric:)/i.exec(beforeFeatures);
  const beforeFabric = fabricMatch ? beforeFeatures.slice(0, fabricMatch.index).trim() : beforeFeatures;
  const fabricPart = fabricMatch
    ? `${fabricMatch[1]}${beforeFeatures.slice(fabricMatch.index + fabricMatch[0].length)}`.trim()
    : "";

  for (const part of [beforeFabric, fabricPart, featuresPart]) {
    const trimmed = part.trim();
    if (trimmed) {
      lines.push(trimmed);
    }
  }
  if (lines.length > 0) {
    return lines.join("\n");
  }
  return text
    .split(/;\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n");
}

const FASHION_BIZ_DETAIL_LABEL_LINE_RE = /^(Sizes|Fabric|Features):/i;

/** After `Features:`, split comma-separated phrases — one line per item with tab + hyphen + tab. */
function bizCollectionFormatFeaturesCommaBullets(s: string): string {
  const lines = s.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const m = /^(\s*)Features:\s*(.*)$/i.exec(line);
    if (!m) {
      out.push(line);
      i += 1;
      continue;
    }
    const prefix = m[1] ?? "";
    let featureText = String(m[2] ?? "").trim();
    i += 1;
    while (i < lines.length) {
      const next = (lines[i] ?? "").trim();
      if (!next || FASHION_BIZ_DETAIL_LABEL_LINE_RE.test(next)) {
        break;
      }
      featureText = `${featureText} ${next}`.replace(/\s+/g, " ").trim();
      i += 1;
    }
    featureText = featureText.replace(/\.\s*,/g, ",").trim();
    if (!featureText.includes(",")) {
      out.push(featureText ? `${prefix}Features: ${featureText}` : `${prefix}Features:`);
      continue;
    }
    const items = featureText
      .split(",")
      .map((x) => x.trim().replace(/^\.+/, "").trim())
      .filter(Boolean);
    if (items.length <= 1) {
      out.push(`${prefix}Features: ${items[0] ?? featureText}`);
      continue;
    }
    out.push(`${prefix}Features:`);
    for (const item of items) {
      out.push(`${prefix}\t-\t${item}`);
    }
  }
  return out.join("\n");
}

/** `Fabric:` line — comma-separated specs on tab-indented sub-lines (matches Features sub-lines). */
function fashionBizFormatFabricLineBullets(text: string): string {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const idx = raw.toLowerCase().indexOf("fabric:");
    if (idx < 0) {
      out.push(raw);
      continue;
    }
    const before = raw.slice(0, idx);
    const after = raw.slice(idx + "fabric:".length);
    const head = `${before}Fabric:`.trimEnd();
    out.push(head.trim().length > 0 ? head : "Fabric:");

    const body = after.replace(/;\s*/g, ", ").trim();
    const items = body
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0 && body.length > 0) {
      out.push(`\t-\t${body}`);
    } else {
      for (const it of items) {
        out.push(`\t-\t${it}`);
      }
    }
  }
  return out.join("\n");
}

function fashionBizFormatPdpDescriptionLayout(s: string): string {
  return fashionBizFormatFabricLineBullets(
    bizCollectionFormatFeaturesCommaBullets(fashionBizBreakSemicolonsToLines(s)),
  );
}

function mergeBizCollectionCsvDetailIntoPdpBody(opts: {
  out: string;
  listingName: string;
  productName: string | null;
  rawDescriptionBody: string;
  supplierName?: string | null;
  storeSlug?: string | null;
  finish: (s: string) => string;
}): string {
  const { out, listingName, productName, rawDescriptionBody, supplierName, storeSlug, finish } = opts;
  if (!isFashionBizSumCsvStorefrontListing(supplierName, listingName)) {
    return finish(out);
  }
  const pack = (s: string) => fashionBizFormatPdpDescriptionLayout(finish(s));
  const code = fashionBizStyleCodeFromListing(listingName, storeSlug);
  if (!code) {
    return pack(out);
  }
  const key = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  const csvRaw = (BIZ_CARE_COLLECTION_STYLE_DETAIL_BODY[key] ?? "").trim();
  if (!csvRaw) {
    return pack(out);
  }
  const csvCleaned = stripCatalogMetadataFromBody(storefrontDescriptionForDisplay(csvRaw));
  if (!csvCleaned) {
    return pack(out);
  }

  const listingHead = listingName.trim().split(/\r?\n/)[0]?.trim() ?? "";
  const stripLo = (s: string) => storefrontStripSupplierBranding(s).toLowerCase().trim();
  const rawLo = stripLo(rawDescriptionBody);
  const outTrim = out.trim();
  const outLo = stripLo(outTrim);
  const pnLo = stripLo(String(productName ?? ""));
  const listingHeadLo = stripLo(listingHead);

  const weak =
    outTrim.length === 0 ||
    rawLo === listingHeadLo ||
    outLo === pnLo ||
    (rawLo.length > 0 && rawLo === outLo && rawLo === listingHeadLo) ||
    (outTrim.length > 0 && outTrim.length < 56 && !outTrim.includes("\n\n"));

  if (weak) {
    return pack(csvCleaned);
  }
  return pack(out);
}

/** Same inputs as PDP `displayProductName` / title stripping — keeps RSC + client description text aligned. */
export type PdpDescriptionComputeFields = {
  name: string;
  description: string;
  slug?: string | null;
  supplierName?: string;
  displayProductName?: string | null;
  displayProductCode?: string | null;
  colorOptions: string[];
  sizeOptions: string[];
};

/**
 * Single source for `mappedProduct.pdpDescriptionBody` and `serverPdpDescriptionBody` on the product page
 * (avoids hydration mismatch when nested cached fields omit `pdpDescriptionBody`).
 */
export function computePdpDescriptionBodyFromDetailFields(p: PdpDescriptionComputeFields): string {
  const { displayProductName, displayProductCode } = p;
  const pdpTitleNameForDescription =
    displayProductName != null || displayProductCode != null
      ? displayProductName ?? null
      : productCardDisplayLines(
          p.name,
          p.description,
          p.slug,
          p.supplierName ?? null,
          p.colorOptions,
          false,
          p.sizeOptions,
        ).productName;

  return productDetailDescriptionBody(
    p.description,
    pdpTitleNameForDescription,
    p.supplierName ?? null,
    p.slug,
    p.name,
  );
}

/**
 * Product detail: description copy without repeating the marketing title block (first paragraph).
 * For Biz Collection / Biz Care / Yes Chef, when the DB text is empty or only echoes the listing name / short title,
 * fills from sum-CSV `stringified_description` (see `lib/biz-care-collection-style-details.generated.ts`).
 */
export function productDetailDescriptionBody(
  description: string | null | undefined,
  productName: string | null,
  supplierName?: string | null,
  /** When `supplier_name` is missing on the row, JB slugs still need pipe→bullet formatting. */
  storeSlug?: string | null,
  /** Raw `products.name` — needed to resolve Fashion Biz style codes for Biz Collection CSV bodies. */
  listingName?: string | null,
): string {
  const listing = String(listingName ?? "").trim();
  const rawBody = description == null ? "" : String(description).trim();
  let cleaned = rawBody ? storefrontDescriptionForDisplay(rawBody) : "";
  if (
    cleaned &&
    (isAussiePacificStorefrontContext(supplierName, storeSlug) ||
      descriptionHasAussiePacificSyncBrandLine(cleaned))
  ) {
    cleaned = stripAussiePacificStructuredMetaLines(cleaned);
    cleaned = formatAussiePacificFabricContinuationLines(cleaned);
    cleaned = formatAussiePacificFeaturesContinuationLines(cleaned);
  }
  if (cleaned && isHeadwearListingContext(storeSlug, supplierName)) {
    cleaned = stripHeadwearStructuredMetaLines(cleaned);
  }
  const sl = normalizeStoreSlugForCatalogPrefix(storeSlug);
  const isJbContext =
    jbSupplierNameMatch(supplierName) || sl.startsWith("jb-") || sl.includes("jbswear");
  const isDncContext = isDncListingContext(storeSlug, supplierName, listing);
  const finish = (s: string) => (isJbContext ? jbWearFormatDescriptionPipesToBullets(s) : s);

  if (isDncContext && /^supplier:\s*https?:\/\//im.test(cleaned)) {
    cleaned = cleaned
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !/^supplier:\s*https?:\/\//i.test(line))
      .join("\n")
      .trim();
  }

  let out = "";
  if (!rawBody) {
    out = "";
  } else if (!productName?.trim()) {
    out = stripCatalogMetadataFromBody(cleaned);
  } else {
    const paras = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (paras.length === 0) {
      out = stripCatalogMetadataFromBody(cleaned);
    } else {
      const firstParaLines = paras[0].split(/\r?\n/);
      const firstLine = firstParaLines[0]?.trim() ?? "";
      if (
        firstLine &&
        storefrontStripSupplierBranding(firstLine).toLowerCase() === productName.trim().toLowerCase()
      ) {
        const firstParaAfterTitle = firstParaLines.slice(1).join("\n").trim();
        const rest = [firstParaAfterTitle, ...paras.slice(1)].filter((s) => s.length > 0).join("\n\n");
        let stripped = stripCatalogMetadataFromBody(rest);
        if (stripped.trim().length > 0) {
          out = stripped;
        } else if (paras.length > 1) {
          stripped = stripCatalogMetadataFromBody(paras.slice(1).join("\n\n"));
          out = stripped.trim().length > 0 ? stripped : "";
        }
        if (!out.trim()) {
          const fullBody = stripCatalogMetadataFromBody(cleaned);
          out = fullBody.trim().length > 0 ? fullBody : "";
        }
      } else {
        out = stripCatalogMetadataFromBody(cleaned);
      }
    }
  }

  return mergeBizCollectionCsvDetailIntoPdpBody({
    out,
    listingName: listing,
    productName,
    rawDescriptionBody: rawBody,
    supplierName,
    storeSlug,
    finish,
  });
}

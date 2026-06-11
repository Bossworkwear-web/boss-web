import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";

import { buildDncProductDescription } from "@/lib/dnc-product-description";
import { getDiscountPercent } from "@/lib/discounts";
import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import { FASHION_BIZ_STYLE_GENDER } from "@/lib/fashion-biz-gender.generated";
import { isBizCareOrCollectionListing, isBizCollectionListing } from "@/lib/fashion-biz-gender-route";
import {
  activeManualSaleRetail,
  storefrontRetailFromSupplierBaseOrFallback,
} from "@/lib/product-price";
import {
  BISLEY_POSITIONAL_GALLERY_COLOR_LABELS,
  bisleyPositionalGalleryStyleUpperFromSlugOrName,
  bisleyReorderDrillImagesToMatchColors,
  bisleySortedPositionalImageUrlsIfComplete,
} from "@/lib/bisley-positional-color-gallery";
import {
  isBizCareCatalogProduct,
  isBizCorporatesCatalogProduct,
  isBisleyCatalogProduct,
  isSyzmikCatalogProduct,
  restrictBisleyOrangeOnlyProductColorsIfNeeded,
} from "@/lib/product-visibility";
import { productPathSegment, slugifyProductNameForPath } from "@/lib/product-path-slug";
import { storefrontDescriptionForDisplay, storefrontLeadingSupplierBrand } from "@/lib/product-display-name";
import { resolveStorefrontImageUrlList } from "@/lib/storefront-image-url";
import { createSupabaseClient } from "@/lib/supabase";
import { syzmikDescriptionBodyFromCsv } from "@/lib/syzmik-description-fallback";

import { normalizeProductSizeOptions } from "@/lib/product-sizes";
import { getGoogleRatingForProductSlug } from "@/lib/product-google-rating";
import {
  bisleyPdpDisplayProductNameWithApexPrefix,
  computePdpDescriptionBodyFromDetailFields,
  productCardDisplayLines,
  syzmikStyleCodeFromListing,
} from "@/lib/product-card-copy";
import {
  applyBizCollectionP29012ColorDisplayRules,
  isBizCollectionP29012Listing,
} from "@/lib/biz-collection-p29012-color-options";
import {
  BIZ_COLLECTION_DETAIL_METADATA_STYLE_BASES,
  BIZ_COLLECTION_GROUP_METADATA_STYLE_BASES,
  isBizCareCid940uExcludedColourChip,
  isBizCollectionDetailMetadataColourChip,
  isBizCollectionGroupMetadataColourChip,
} from "@/lib/biz-collection-metadata-colour-chips";
import {
  filterAp2211ColorOptions,
  isStorefrontAp2211Slug,
} from "@/lib/ap-2211-storefront";
import { filterAp3309ColorOptions, isStorefrontAp3309Slug } from "@/lib/ap-3309-storefront";
import { filterAp2311ColorOptions, isStorefrontAp2311Slug } from "@/lib/ap-2311-storefront";
import { resolveApPdpGalleryState } from "@/lib/ap-pdp-gallery";
import {
  isStorefrontYesChefCh234mPdp,
  isYesChefCh234mExcludedColourChip,
} from "@/lib/yes-chef-ch234m-pdp-colour";
import {
  repositionAp2310BlackRedBackAfterSeventh,
  urlLooksLikeAp2310BackAsset,
  isStorefrontAp2310Slug,
} from "@/lib/ap-2310-gallery-back";
import { applyJb7pipBlackRedFirstPdp } from "@/lib/jb-7pip-pdp-colors";

import { TopNav } from "@/app/components/top-nav";
import { JsonLd } from "@/app/components/json-ld";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";

import type { PlacementData, ProductDetailData } from "../premium-work-polo/premium-work-polo-client";

import { PremiumWorkPoloClientDynamic } from "./premium-work-polo-client-dynamic";

export const dynamic = "force-dynamic";

const DEFAULT_PDP_FALLBACK_IMAGES: string[] = [
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1592878940526-0214b0f374f6?auto=format&fit=crop&w=1200&q=80",
];

// Biz Care unisex: hero should feature both male + female together (fallback when no supplier images).
const BIZ_CARE_UNISEX_HERO_IMAGE =
  "https://images.unsplash.com/photo-1580281657527-47f249e8f6f1?auto=format&fit=crop&w=1600&q=80";

/** PDP colour chip cap (gallery sync allows more images per product). */
const MAX_STOREFRONT_COLOR_OPTIONS = 48;

function moveImageUrlToFront(urls: string[], wantSubstringUpper: string): string[] {
  const idx = urls.findIndex((u) => String(u).toUpperCase().includes(wantSubstringUpper));
  if (idx <= 0) {
    return urls;
  }
  return [urls[idx], ...urls.slice(0, idx), ...urls.slice(idx + 1)];
}

/** Biz Collection sync sometimes prefixes chip labels with `{STYLE} / ` — strip for storefront readability. */
function stripBizCollectionStyleSlashColorPrefix(colors: string[], styleBaseUpper: string): string[] {
  const esc = styleBaseUpper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*${esc}\\s*\\/\\s*`, "i");
  return colors.map((c) => {
    const t = String(c).replace(re, "").trim();
    return t.length > 0 ? t : String(c);
  });
}

type ProductDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const fallbackPlacements: PlacementData[] = [
  { id: "left-chest", name: "Left Chest" },
  { id: "right-chest", name: "Right Chest" },
  { id: "full-back", name: "Full Back" },
  { id: "full-chest", name: "Full Chest" },
  { id: "back-upper", name: "Back Upper" },
  { id: "back-middle", name: "Back Middle" },
  { id: "left-sleeve", name: "Left Sleeve" },
  { id: "right-sleeve", name: "Right Sleeve" },
];

function placementMergeKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same storefront placement as “Full Back” (FB diagram); avoids duplicate rows when DB still uses an older label. */
function placementDedupeKey(name: string): string {
  const k = placementMergeKey(name);
  if (k === "front bottom" || k === "front full" || k === "full back") {
    return "full back";
  }
  if (k === "front collar" || k === "full chest") {
    return "full chest";
  }
  return k;
}

function normalizePlacementLabelsForStorefront(rows: PlacementData[]): PlacementData[] {
  return rows.map((p) => {
    const k = placementMergeKey(p.name);
    if (k === "front bottom" || k === "front full") {
      return { ...p, name: "Full Back" };
    }
    if (k === "front collar") {
      return { ...p, name: "Full Chest" };
    }
    return p;
  });
}

/** If the DB accidentally has two names for the same role (e.g. Front Full + Full Back), keep one row. */
function dedupePlacementsByStorefrontRole(rows: PlacementData[]): PlacementData[] {
  const out: PlacementData[] = [];
  const seen = new Set<string>();
  for (const p of rows) {
    const dk = placementDedupeKey(p.name);
    if (seen.has(dk)) {
      continue;
    }
    seen.add(dk);
    out.push(p);
  }
  return out;
}

/** When Supabase has rows but is missing newer positions (e.g. Full Back / Full Chest), append defaults so diagrams + selectors stay in sync. */
function mergePlacementsWithFallback(
  db: PlacementData[] | null | undefined,
  fallback: PlacementData[],
): PlacementData[] {
  const rows = db?.length ? [...db] : [];
  if (rows.length === 0) {
    return fallback;
  }
  const seen = new Set(rows.map((p) => placementDedupeKey(p.name)));
  for (const f of fallback) {
    const k = placementDedupeKey(f.name);
    if (!seen.has(k)) {
      seen.add(k);
      rows.push(f);
    }
  }
  return rows;
}

/** Storefront / quote: consistent order (DB `order("name")` would put "Back Middle" before "Back Upper"). */
function sortPlacementsForProductPage(placements: PlacementData[]): PlacementData[] {
  const rank = (name: string): number => {
    const n = name.trim().toLowerCase();
    const table: Record<string, number> = {
      "left chest": 10,
      "left-hand chest": 10,
      "right chest": 20,
      "center chest": 30,
      "full back": 31,
      "front full": 31,
      "front bottom": 31,
      "full chest": 32,
      "front collar": 32,
      "back upper": 40,
      "back middle": 41,
      back: 42,
      "left sleeve": 50,
      "right sleeve": 60,
    };
    return table[n] ?? 500;
  };
  return [...placements].sort((a, b) => {
    const d = rank(a.name) - rank(b.name);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
}

function toSlug(input: string) {
  return slugifyProductNameForPath(input);
}

function inferCategoryFromName(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("polo")) {
    return "Polos";
  }
  if (normalized.includes("work")) {
    return "Work Shirts";
  }
  if (normalized.includes("scrub")) {
    return "Scrubs";
  }
  return "T-shirts";
}

function getFallbackColors(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("polo")) {
    return ["Navy", "Black", "White", "Grey", "Royal Blue", "Maroon"];
  }
  if (normalized.includes("work")) {
    return ["Navy", "Khaki", "Charcoal", "Orange", "Hi-Vis Yellow", "Black"];
  }
  if (normalized.includes("scrub")) {
    return ["Navy", "Teal", "Ceil Blue", "Black", "Grey", "Wine"];
  }
  return ["Black", "White", "Navy", "Grey"];
}

function compactColorDedupeKey(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function bisleyColorNameFromCode(raw: string): string | null {
  const key = String(raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (!key) return null;
  const map: Record<string, string> = {
    // Observed Bisley catalog codes in filenames (e.g. BBEAN55_BBLK_…, BBEAN55_BF51_…)
    BBLK: "Black",
    // Some feeds use plain colour words in the token slot (e.g. `BS1144-BLACK-FRONT.jpg`).
    BLACK: "Black",
    BF51: "Yellow",
    BF61: "Orange",
    // Bisley drill shirts (e.g. BSC1820/BSC6820)
    BCDR: "Khaki",
    BPCT: "Navy",
    // Bisley drill shirts: `SAN` tokens are Sand; `BVCB` observed as Royal in drills.
    BSAN: "Sand",
    BSAND: "Sand",
    BVCB: "Royal",
    // Bisley drills / shirts (BSC1433/BSC6433)
    BGRG: "Bottle",
    BVEO: "Orange",
    // Bisley shirt codes (B71526, etc.)
    BPLB: "Sky",
    BWHT: "White",
    // Bisley shirts (BS1526/BS6526 observed codes)
    BDKN: "Midnight",
    BPEY: "Sand",
    // Bisley BLC6063 observed codes
    BOLV: "Olive",
    // Some Bisley assets use plain colour words as the token (e.g. `B71526_MIDNIGHT_01.jpg`).
    SKY: "Sky",
    WHITE: "White",
    MIDNIGHT: "Midnight",
    SAND: "Sand",
    // Bisley BS1133 (Charcoal)
    BCCG: "Charcoal",
    // Bisley BS1144 (Stone)
    BSTN: "Stone",
    // Bisley BS1030
    BCRU: "Blue",
    BLWR: "Green",
  };
  return map[key] ?? null;
}

function bisleyDisplayColorFromImageFilename(fileNoQuery: string): string | null {
  // Supports both `STYLE_CODE_01.jpg` and `STYLE_CODE.jpg` patterns.
  const m = fileNoQuery.match(/^[A-Za-z0-9]+[_-]([A-Za-z0-9]{3,16})(?:[_-]|\.)/);
  if (!m?.[1]) return null;
  return bisleyColorNameFromCode(m[1]);
}

/** Append filename-derived colours missing from the DB list (e.g. Bisley CSV vs full `_Product_` gallery). */
function mergeColorOptionsFromFilenameDerivation(
  primary: string[],
  fromImages: string[],
  max: number,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of primary) {
    const t = c.trim();
    if (!t) continue;
    const k = compactColorDedupeKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) {
      return out;
    }
  }
  for (const c of fromImages) {
    const t = c.trim();
    if (!t) continue;
    const k = compactColorDedupeKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) {
      return out;
    }
  }
  return out;
}

function normalizeDbColors(raw: string[] | null | undefined) {
  return (raw ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, MAX_STOREFRONT_COLOR_OPTIONS);
}

function normalizeComparableText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ");
}

function descriptionLooksLikeTitleOnly(description: string, name: string): boolean {
  const d = normalizeComparableText(description);
  const n = normalizeComparableText(name);
  if (!d) return true;
  if (d === n) return true;
  const dStripped = d.replace(/^\s*syzmik\s+/i, "").trim();
  const nStripped = n.replace(/^\s*syzmik\s+/i, "").trim();
  return dStripped.length > 0 && dStripped === nStripped;
}

function syzmikDescriptionLooksLikeTitleOnly(description: string): boolean {
  const d = String(description ?? "").trim();
  if (!d) return true;
  // If it's a single short line, it's almost certainly a marketing title (not a body).
  if (!d.includes("\n") && d.length <= 140) return true;
  // Some imports include the title and nothing else as two very short lines.
  const lines = d.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length <= 2 && lines.join(" ").length <= 160) return true;
  return false;
}


function parseJbPrefixCountFromFirstImageUrl(imageUrls: string[]): number {
  const first = typeof imageUrls?.[0] === "string" ? imageUrls[0] : "";
  const m = /#jbpc=(\d+)$/i.exec(first);
  if (!m?.[1]) return 0;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function jbColorNameFromCode(raw: string): string | null {
  const key = String(raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (!key) return null;
  const map: Record<string, string> = {
    B: "Black",
    BX: "Black",
    N: "Navy",
    NX: "Navy",
    W: "White",
    WX: "White",
    R: "Red",
    RX: "Red",
    RO: "Royal",
    RY: "Royal",
    C: "Charcoal",
    CX: "Charcoal",
    G: "Gunmetal",
    GX: "Grey",
    G1: "Gunmetal",
    Q: "Graphite",
    QQ: "Graphite Marle",
    TT: "Slate",
    FF: "Army",
    A: "Aqua",
    AQ: "Aqua",
    LM: "Lime",
    Y: "Yellow",
    O: "Orange",
    PK: "Pink",
    PU: "Purple",
    BR: "Brown",
    KH: "Khaki",
    SD: "Sand",
    CR: "Cream",
    SI: "Silver",
    GD: "Gold",
  };
  return map[key] ?? null;
}

function jbStyleCodeUpperFromProductSlug(productSlugLower: string): string | null {
  const s = productSlugLower.trim().toLowerCase();
  if (!s.startsWith("jb-")) {
    return null;
  }
  const rest = s.slice(3).replace(/-/g, "");
  if (!rest || rest.length < 2 || rest.length > 12 || !/^[a-z0-9]+$/.test(rest)) {
    return null;
  }
  return rest.toUpperCase();
}

function deriveJbColorsFromImageUrls(imageUrls: string[], styleUpper: string | null = null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of imageUrls) {
    if (typeof url !== "string" || !url.trim()) continue;
    const tail = url.split("/").pop() ?? url;
    let file = tail;
    try {
      file = decodeURIComponent(tail);
    } catch {
      file = tail;
    }
    const fileNoQuery = (file.split("?")[0] ?? file).trim();
    const m = fileNoQuery.match(/^[A-Za-z0-9]+[_-]([A-Za-z0-9]{1,3})X?[_-]/);
    let code = m?.[1] ? String(m[1]) : "";
    if (!code && styleUpper) {
      const base = fileNoQuery.replace(/\.[^.]+$/i, "");
      if (base.length > styleUpper.length) {
        const up = base.toUpperCase();
        if (up.startsWith(styleUpper)) {
          const after = base.slice(styleUpper.length);
          const m2 = after.match(/^([A-Za-z0-9]{1,3})X?[_-]/);
          if (m2?.[1]) {
            code = String(m2[1]);
          }
        }
      }
    }
    const mapped = code ? jbColorNameFromCode(code) : null;
    if (!mapped) continue;
    const k = mapped.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(mapped);
  }
  return out.slice(0, MAX_STOREFRONT_COLOR_OPTIONS);
}

function humanizeColorToken(raw: string) {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

const SIMPLE_COLOR_WORDS = new Set(
  [
    "black",
    "white",
    "red",
    "gold",
    "navy",
    "royal",
    "maroon",
    "charcoal",
    "grey",
    "gray",
    "orange",
    "yellow",
    "green",
    "blue",
    "pink",
    "purple",
    "brown",
    "khaki",
    "lime",
    "aqua",
    "teal",
    "silver",
    "natural",
    "sand",
    "cream",
  ].map((s) => s.toLowerCase()),
);

function titleCaseWord(w: string) {
  return w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1).toLowerCase();
}

function formatComboColorFromWords(words: string[]) {
  return words.map(titleCaseWord).join(" / ");
}

function extractColorTokenFromFilename(file: string): string | null {
  const clean = file.trim();
  if (!clean) return null;

  // 1) Preferred: ..._Product_<Color>_.. or ..._Talent_<Color>_..
  const shot = clean.match(/_(?:Product|Talent)_([A-Za-z0-9_-]+)_/i);
  if (shot?.[1]) return shot[1];

  // 2) Common supplier patterns: <SKU>_<Color>_<NN>.jpg  (optionally with Product/Talent segment absent)
  // Example: P700KS_BlackGold_01.jpg
  const generic = clean.match(/^[A-Za-z0-9]+_([A-Za-z0-9_-]+)_(?:\d{1,3})\.[A-Za-z0-9]+$/i);
  if (generic?.[1]) return generic[1];

  // 3) Fallback: <anything>_<Color>_<NN>.<ext> (avoid grabbing the SKU-only segment)
  const tail = clean.match(/_([A-Za-z0-9_-]+)_(?:\d{1,3})\.[A-Za-z0-9]+$/i);
  if (tail?.[1]) return tail[1];

  return null;
}

function isComboColorLabel(label: string) {
  return label.includes(" / ");
}

function deriveColorOptionsFromImageUrls(imageUrls: string[]): string[] {
  const out: string[] = [];

  const pushFromFile = (fileNoQuery: string) => {
    const token = extractColorTokenFromFilename(fileNoQuery);
    if (!token) return;
    // Prefer a deterministic "combo" label when the supplier token uses explicit separators.
    // Example: `Navy_Sky_Silver` → `Navy / Sky / Silver`
    if (/[_-]/.test(token)) {
      const parts = token
        .split(/[_-]+/g)
        .map((p) => humanizeColorToken(p))
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        out.push(parts.join(" / "));
        return;
      }
    }

    const human = humanizeColorToken(token);
    if (!human) return;

    const words = human
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean);

    // Heuristic: if every word is a simple color word, treat it as a combo color (Black / Gold / White).
    if (words.length >= 2 && words.every((w) => SIMPLE_COLOR_WORDS.has(w))) {
      out.push(formatComboColorFromWords(words));
      return;
    }

    // Otherwise keep the humanised token as-is (e.g. "Midnight Navy" stays a single colour name).
    out.push(human);
  };

  // Pass 1: Product-only (preferred).
  for (const url of imageUrls) {
    if (typeof url !== "string") continue;
    const file = decodeURIComponent(url.split("/").pop() ?? url);
    const fileNoQuery = (file.split("?")[0] ?? file).trim();
    // Only derive colour options from product shots. "Talent" images are on-model/marketing,
    // and may include hero-only variants that should not create extra colour buttons.
    if (/_Talent_/i.test(fileNoQuery)) {
      continue;
    }
    pushFromFile(fileNoQuery);
  }

  // Pass 2: If we couldn't derive any colors from Product shots, allow Talent images too.
  if (out.length === 0) {
    for (const url of imageUrls) {
      if (typeof url !== "string") continue;
      const file = decodeURIComponent(url.split("/").pop() ?? url);
      const fileNoQuery = (file.split("?")[0] ?? file).trim();
      pushFromFile(fileNoQuery);
    }
  }

  return out
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, MAX_STOREFRONT_COLOR_OPTIONS);
}

function normalizeRouteSlug(raw: string) {
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

type ProductRow = {
  id: string;
  name: string;
  base_price: number | null;
  sale_price?: number | null;
  is_active?: boolean | null;
  slug?: string | null;
  category?: string | null;
  description?: string | null;
  features?: string | null;
  specifications?: string | null;
  image_urls?: string[] | null;
  available_colors?: string[] | null;
  available_sizes?: string[] | null;
  supplier_name?: string | null;
  storefront_hidden?: boolean | null;
};

const PRODUCT_SELECT_RICH =
  "id, name, base_price, sale_price, is_active, slug, category, description, features, specifications, image_urls, available_colors, available_sizes, supplier_name, storefront_hidden";
const PRODUCT_SELECT_MID =
  "id, name, base_price, sale_price, is_active, slug, category, description, image_urls, available_colors, available_sizes, storefront_hidden";
const PRODUCT_SELECT_MIN = "id, name, base_price, slug, storefront_hidden";

/** Narrow columns while scanning pages for name-derived path slugs (then load full row by id). */
const PRODUCT_SELECT_SCAN = "id, name, slug";

function pathSlugVariations(slug: string) {
  return [...new Set([slug, slug.toLowerCase(), slug.toUpperCase()].filter((s) => s.length > 0))];
}

function rowMatchesPathSlug(item: ProductRow, slug: string) {
  const rowSlug = item.slug != null && String(item.slug).trim() ? String(item.slug).trim() : "";
  if (rowSlug.length > 0 && rowSlug === slug) return true;
  if (rowSlug.length > 0 && rowSlug.toLowerCase() === slug.toLowerCase()) return true;
  const nameSlug = toSlug(item.name);
  return nameSlug === slug || nameSlug.toLowerCase() === slug.toLowerCase();
}

/**
 * PostgREST returns a default max row window (~1000). Never rely on “load all then .find”.
 */
async function findProductRowByPathSlug(
  supabase: ReturnType<typeof createSupabaseClient>,
  slug: string,
): Promise<ProductRow | null> {
  let workingSelect = PRODUCT_SELECT_RICH;
  for (const cols of [PRODUCT_SELECT_RICH, PRODUCT_SELECT_MID, PRODUCT_SELECT_MIN]) {
    const { error } = await supabase.from("products").select(cols).limit(1);
    if (!error) {
      workingSelect = cols;
      break;
    }
  }

  for (const s of pathSlugVariations(slug)) {
    const { data, error } = await supabase.from("products").select(workingSelect).eq("slug", s).maybeSingle();
    if (!error && data && typeof data === "object" && "id" in data) {
      return data as unknown as ProductRow;
    }
  }

  const pageSize = 1000;
  const maxScan = 25_000;
  for (let offset = 0; offset < maxScan; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT_SCAN)
      .order("name")
      .range(offset, offset + pageSize - 1);

    if (error || !data?.length) {
      return null;
    }
    const hit = (data as unknown as ProductRow[]).find((item) => rowMatchesPathSlug(item, slug));
    if (hit) {
      const { data: full, error: fullErr } = await supabase
        .from("products")
        .select(workingSelect)
        .eq("id", hit.id)
        .maybeSingle();
      if (fullErr || !full || typeof full !== "object" || !("id" in full)) {
        return null;
      }
      return full as unknown as ProductRow;
    }
    if (data.length < pageSize) {
      return null;
    }
  }

  return null;
}

async function getDetailDataInternal(
  slug: string,
): Promise<{ product: ProductDetailData; placements: PlacementData[] } | null> {
  try {
    const supabase = createSupabaseClient();

    const product = await findProductRowByPathSlug(supabase, slug);

    if (!product) {
      return null;
    }
    if (product.storefront_hidden) {
      return null;
    }

    const { data: positions } = await supabase.from("embroidery_positions").select("id, name");

    if (
      isBizCorporatesCatalogProduct(product.name, {
        slug: "slug" in product ? product.slug : null,
        category: "category" in product ? product.category : null,
      })
    ) {
      return null;
    }

    const fallbackColors = getFallbackColors(product.name);

    const listRetail = storefrontRetailFromSupplierBaseOrFallback(product.base_price, 25.0);
    const saleRaw = "sale_price" in product ? product.sale_price : null;
    const manualSale = activeManualSaleRetail(listRetail, saleRaw);
    const discountPercent = getDiscountPercent(product.name);
    const basePrice =
      manualSale != null
        ? manualSale
        : discountPercent > 0
          ? listRetail * (1 - discountPercent / 100)
          : listRetail;

    const supplierNameRaw =
      "supplier_name" in product && product.supplier_name != null
        ? String(product.supplier_name).trim()
        : "";

    const dbDescription =
      product.description != null && String(product.description).trim().length > 0
        ? String(product.description).trim()
        : null;

    const relatedStyleCodes = (() => {
      if (!dbDescription) return [];
      const m = dbDescription.match(/^Related styles:\s*(.+)$/im);
      if (!m?.[1]) return [];
      return m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toUpperCase())
        .slice(0, 18);
    })();

    const dbFeatures =
      "features" in product &&
      product.features != null &&
      String(product.features).trim().length > 0
        ? storefrontDescriptionForDisplay(String(product.features).trim())
        : null;

    const dbSpecifications =
      "specifications" in product &&
      product.specifications != null &&
      String(product.specifications).trim().length > 0
        ? storefrontDescriptionForDisplay(String(product.specifications).trim())
        : null;

    const googleRating = await getGoogleRatingForProductSlug(slug);

    const isSyzmikCatalog = isSyzmikCatalogProduct(product.name, {
      slug: "slug" in product ? product.slug : null,
      supplier_name: supplierNameRaw || null,
      description: dbDescription,
      category: "category" in product ? product.category : null,
    });

    const effectivePdpDescription = (() => {
      if (!dbDescription) {
        return null;
      }
      // Syzmik imports sometimes store the marketing title in `description` with no body copy.
      // If so, use Features/Specifications as the PDP body instead.
      if (
        isSyzmikCatalog &&
        (descriptionLooksLikeTitleOnly(dbDescription, product.name) || syzmikDescriptionLooksLikeTitleOnly(dbDescription))
      ) {
        const parts = [dbFeatures, dbSpecifications].filter((s): s is string => Boolean(s && s.trim().length > 0));
        if (parts.length > 0) {
          return parts.join("\n\n");
        }
        const styleUpper = syzmikStyleCodeFromListing(
          product.name,
          String(product.slug?.trim() ? product.slug : slug),
          supplierNameRaw,
        );
        const csvBody = styleUpper ? syzmikDescriptionBodyFromCsv(styleUpper) : null;
        return csvBody && csvBody.trim().length > 0 ? csvBody : null;
      }
      return dbDescription;
    })();

    const relatedProducts = await (async () => {
      const styleUpper =
        fashionBizStyleCodeFromListing(product.name, product.slug ?? null)?.toUpperCase().replace(/-CLEARANCE$/i, "") ??
        "";
      if (
        styleUpper === "S421ML" &&
        isBizCollectionListing(product.name, product.slug ?? null, product.category ?? null)
      ) {
        return [];
      }
      if (!supplierNameRaw || relatedStyleCodes.length === 0) {
        return [];
      }
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, image_urls, supplier_name, storefront_hidden, is_active")
        .eq("supplier_name", supplierNameRaw);
      if (error) {
        return [];
      }
      const extractStyle = (n: string): string | null => {
        const mm = String(n).trim().match(/\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/);
        return mm ? mm[1].toUpperCase() : null;
      };
      const wanted = new Set(relatedStyleCodes);
      const rows = (data ?? [])
        .filter((r) => r && r.id !== product.id)
        .filter((r) => !r.storefront_hidden)
        .filter((r) => r.is_active !== false)
        .map((r) => ({
          id: String(r.id),
          name: String(r.name),
          slug: String(r.slug ?? ""),
          style: extractStyle(String(r.name)),
          imageUrl:
            Array.isArray(r.image_urls) && r.image_urls.length > 0
              ? resolveStorefrontImageUrlList(r.image_urls)[0] ?? null
              : null,
        }))
        .filter((r) => r.slug.trim().length > 0)
        .filter((r) => r.style && wanted.has(r.style))
        .sort((a, b) => a.style!.localeCompare(b.style!))
        .slice(0, 18)
        .map(({ style: _style, ...rest }) => rest);
      return rows;
    })();

    const wantsBizCareUnisexHero = (() => {
      if (!isBizCareCatalogProduct(product.name, { slug: product.slug ?? null, category: product.category ?? null })) {
        return false;
      }
      const code = fashionBizStyleCodeFromListing(product.name, product.slug ?? null);
      if (!code) {
        return false;
      }
      return FASHION_BIZ_STYLE_GENDER[code] === "unisex";
    })();

    const normalizedImageUrlsRaw =
      product.image_urls && product.image_urls.length > 0
        ? product.image_urls
        : wantsBizCareUnisexHero
          ? [BIZ_CARE_UNISEX_HERO_IMAGE, ...DEFAULT_PDP_FALLBACK_IMAGES]
          : DEFAULT_PDP_FALLBACK_IMAGES;

    const productCodeUpper = (() => {
      const m = product.name.match(/\(([A-Za-z0-9]+)\)\s*$/);
      return m?.[1] ? m[1].toUpperCase() : "";
    })();

    let normalizedImageUrls = resolveStorefrontImageUrlList(
      (() => {
        const code = fashionBizStyleCodeFromListing(product.name, product.slug ?? null);
        if (code?.toUpperCase() === "CL542UL") {
          return moveImageUrlToFront(normalizedImageUrlsRaw, "CL542UL_TALENT_MIDNIGHTNAVY_07.JPG");
        }
        return normalizedImageUrlsRaw;
      })(),
    );

    // JB's Wear: if images are supplier-media paths but the JB catalogue hasn't been uploaded to Storage,
    // these URLs 404 and break the PDP. Fall back to generic images so the page remains usable.
    const supplierLcEarly = (supplierNameRaw ?? "").trim().toLowerCase();
    const slugLowerEarly = String((product.slug?.trim() ? product.slug : slug) ?? "")
      .trim()
      .toLowerCase();
    const isJbWearEarly =
      supplierLcEarly === "jb's wear" ||
      supplierLcEarly === "jbs wear" ||
      supplierLcEarly === "jbswear" ||
      slugLowerEarly.startsWith("jb-") ||
      slugLowerEarly.includes("jbswear");
    if (
      isJbWearEarly &&
      normalizedImageUrls.length > 0 &&
      normalizedImageUrls.every((u) => /^\/api\/supplier-media\/jb\//i.test(String(u)))
    ) {
      normalizedImageUrls = [...DEFAULT_PDP_FALLBACK_IMAGES];
    }

    // Blue Whale: ensure supplier-media images belong to the current style code (imports sometimes mis-link nearby SKUs).
    if ((supplierNameRaw ?? "").trim().toLowerCase() === "blue whale" && productCodeUpper) {
      const keep = normalizedImageUrls.filter((u) => {
        const tail = String(u).split("/").pop() ?? String(u);
        let file = tail;
        try {
          file = decodeURIComponent(tail);
        } catch {
          file = tail;
        }
        return file.toUpperCase().includes(productCodeUpper);
      });
      if (keep.length >= 2) {
        // Prefer colour-specific shots over generic "Model" images as the hero.
        const model = keep.filter((u) => /model/i.test(String(u)));
        const rest = keep.filter((u) => !/model/i.test(String(u)));
        normalizedImageUrls = rest.length > 0 ? [...rest, ...model] : keep;
      }
    }

    const productSlugLower = String(("slug" in product && product.slug ? product.slug : slug) ?? "")
      .trim()
      .toLowerCase();

    // JB's Wear 4P: hide second gallery image (requested).
    {
      const supplierLcJb = supplierNameRaw.trim().toLowerCase();
      const isJbWear =
        supplierLcJb === "jb's wear" ||
        supplierLcJb === "jbs wear" ||
        supplierLcJb === "jbswear" ||
        productSlugLower.startsWith("jb-") ||
        productSlugLower.includes("jbswear");
      if (isJbWear && normalizedImageUrls.length >= 2) {
        const isJb4PStyle =
          jbStyleCodeUpperFromProductSlug(productSlugLower) === "4P" ||
          /(^|-)jb-4p(\b|-|$)/i.test(productSlugLower) ||
          /\(\s*4P\s*\)\s*$/i.test(String(product.name ?? ""));
        if (isJb4PStyle) {
          normalizedImageUrls = normalizedImageUrls.filter((_, i) => i !== 1);
        }
      }
    }

    let normalizedColorOptions = normalizeDbColors(product.available_colors);
    const derivedFromImages = deriveColorOptionsFromImageUrls(normalizedImageUrls);
    const isBisleyCatalog = isBisleyCatalogProduct(product.name, {
      slug: "slug" in product ? product.slug : null,
      supplier_name: supplierNameRaw || null,
      description: dbDescription,
      category: "category" in product ? product.category : null,
    });

    // Blue Whale: DB sometimes lists only one colour while multiple colour images exist (e.g. F84 has Orange+Yellow).
    // When we can derive 2+ colours from filenames, prefer that list so chips match available imagery.
    const isBlueWhaleCatalog = supplierNameRaw.trim().toLowerCase() === "blue whale";
    if (isBlueWhaleCatalog && normalizedColorOptions.length <= 1 && derivedFromImages.length >= 2) {
      normalizedColorOptions = derivedFromImages;
    }
    // Prefer derived combo colours (e.g. "Black / Gold") when we can extract them from filenames.
    const derivedHasCombo = derivedFromImages.some(isComboColorLabel);
    const dbHasCombo = normalizedColorOptions.some(isComboColorLabel);
    // Match storefront branding rules: supplier row OR our `ap-…` import slug prefix.
    const isAussiePacificCatalog =
      supplierNameRaw.trim().toLowerCase() === "aussie pacific" || productSlugLower.startsWith("ap-");
    /** Biz Care / Biz Collection / Syzmik folder sync (`sync-supplier-catalog.mjs`) — DB colours match gallery blocks. */
    const supplierLc = supplierNameRaw.trim().toLowerCase();
    const isFashionBizFolderCatalog =
      supplierLc.includes("biz collection") ||
      supplierLc.includes("biz care") ||
      supplierLc.includes("syzmik");
    const isJbWearCatalog =
      supplierNameRaw.trim().toLowerCase() === "jb's wear" ||
      supplierNameRaw.trim().toLowerCase() === "jbs wear" ||
      supplierNameRaw.trim().toLowerCase() === "jbswear" ||
      productSlugLower.startsWith("jb-") ||
      productSlugLower.includes("jbswear");
    const isDncCatalog =
      supplierNameRaw.trim().toLowerCase() === "dnc workwear" ||
      supplierNameRaw.trim().toLowerCase() === "dnc" ||
      productSlugLower.startsWith("dnc-");
    const jbPrefixCount = isJbWearCatalog ? parseJbPrefixCountFromFirstImageUrl(normalizedImageUrls) : 0;
    const jbDerivedColors =
      isJbWearCatalog && jbPrefixCount === 0
        ? deriveJbColorsFromImageUrls(normalizedImageUrls, jbStyleCodeUpperFromProductSlug(productSlugLower))
        : [];
    const imageUrlsLookDerivable = normalizedImageUrls.some((u) => {
      if (typeof u !== "string") return false;
      const tail = u.split("/").pop() ?? u;
      let file = tail;
      try {
        file = decodeURIComponent(tail);
      } catch {
        file = tail;
      }
      const fileNoQuery = (file.split("?")[0] ?? file).trim();
      return (
        /_(?:Product|Talent)_/i.test(fileNoQuery) ||
        /^[A-Za-z0-9]+_[A-Za-z0-9_-]+_(?:\d{1,3})\.[A-Za-z0-9]+$/i.test(fileNoQuery)
      );
    });
    let colorOptionsEffective = (() => {
      // Aussie Pacific images are hosted on opaque S3 keys — filename heuristics are not reliable
      // and can produce nonsense "colour" labels. Prefer DB colours from the API sync.
      if (isAussiePacificCatalog) {
        return normalizedColorOptions.length > 0 ? normalizedColorOptions : fallbackColors;
      }
      // Fashion Biz folder import: `available_colors` order matches colour-grouped `image_urls`; do not merge
      // filename-derived options (different ordering / dedupe) or chips ↔ gallery desync.
      if (isFashionBizFolderCatalog) {
        return normalizedColorOptions.length > 0 ? normalizedColorOptions : fallbackColors;
      }
      // JB's Wear: `import-jbswear-xlsx.mjs` can order the first N gallery images to match the XLSX colour list
      // (`#jbpc=N`). Do not override those colours with derived filename guesses, otherwise chips ↔ images desync.
      if (isJbWearCatalog && jbPrefixCount > 0) {
        return normalizedColorOptions.length > 0 ? normalizedColorOptions : fallbackColors;
      }
      // DNC Workwear: `import-dnc-csv.mjs` orders colours and heroes by variant colour code (`#dncc=N`).
      if (isDncCatalog && normalizedColorOptions.length > 0) {
        return normalizedColorOptions;
      }
      // JB's Wear: if DB colours don't align with JB filename colour codes, prefer derived colours so chips
      // always map to an existing image.
      if (isJbWearCatalog && jbDerivedColors.length >= 2) {
        return jbDerivedColors;
      }
      // Opaque CDN URLs often contain random `_` / `-` segments; splitting them yields fake "A / B"
      // combo labels and incorrectly wins over real DB colours. Only prefer derived combos when
      // at least one URL looks like a supplier filename we understand.
      // Bisley: do NOT prefer derived combos over DB colours (tokens like `BPCT_01` create bogus chips).
      if (derivedHasCombo && !dbHasCombo && imageUrlsLookDerivable && !(isBisleyCatalog && normalizedColorOptions.length > 0)) {
        return derivedFromImages;
      }
      if (normalizedColorOptions.length > 0) {
        return normalizedColorOptions;
      }
      if (imageUrlsLookDerivable && derivedFromImages.length > 0) {
        return derivedFromImages;
      }
      return fallbackColors;
    })();
    if (isBisleyCatalog && normalizedColorOptions.length <= 1 && derivedFromImages.length >= 2) {
      colorOptionsEffective = derivedFromImages;
    }
    if (
      !isAussiePacificCatalog &&
      !isFashionBizFolderCatalog &&
      !isJbWearCatalog &&
      !isDncCatalog &&
      // Bisley PDP: DB colours are the source of truth when present; filename tokens often add bogus chips.
      !(isBisleyCatalog && normalizedColorOptions.length > 0) &&
      imageUrlsLookDerivable &&
      derivedFromImages.length > 0
    ) {
      colorOptionsEffective = mergeColorOptionsFromFilenameDerivation(
        colorOptionsEffective,
        derivedFromImages,
        MAX_STOREFRONT_COLOR_OPTIONS,
      );
    }
    colorOptionsEffective = restrictBisleyOrangeOnlyProductColorsIfNeeded(product.name, {
      slug: "slug" in product ? product.slug : null,
      supplier_name: supplierNameRaw || null,
      description: dbDescription,
    }, colorOptionsEffective);

    // Biz Collection S421ML / S421LL: sync may emit `Group` as a colour slot (mix-and-match metadata); it is not a garment colour.
    // When gallery URLs are evenly partitioned per colour, drop the matching image block so chip index ↔ gallery stays aligned.
    {
      const fbStyle = fashionBizStyleCodeFromListing(product.name, productSlugLower);
      const styleBase = fbStyle ? fbStyle.replace(/-CLEARANCE$/i, "") : "";
      if (
        BIZ_COLLECTION_GROUP_METADATA_STYLE_BASES.has(styleBase) &&
        isBizCareOrCollectionListing(
          product.name,
          productSlugLower,
          "category" in product ? product.category : null,
        )
      ) {
        const n = colorOptionsEffective.length;
        const gi = colorOptionsEffective.findIndex((c) => isBizCollectionGroupMetadataColourChip(c));
        if (gi >= 0) {
          colorOptionsEffective = colorOptionsEffective.filter(
            (c) => !isBizCollectionGroupMetadataColourChip(c),
          );
          const m = normalizedImageUrls.length;
          if (n > 1 && m % n === 0) {
            const stride = m / n;
            const start = gi * stride;
            normalizedImageUrls = [
              ...normalizedImageUrls.slice(0, start),
              ...normalizedImageUrls.slice(start + stride),
            ];
          }
        }
      }
    }

    // Biz Care / Biz Collection (WP10310, BS724M, LB8200, CH248L, …): sync may emit `Detail` / `Detail / Multi` (metadata); not a garment colour.
    {
      const fbStyle = fashionBizStyleCodeFromListing(product.name, productSlugLower);
      const styleBase = fbStyle ? fbStyle.replace(/-CLEARANCE$/i, "") : "";
      if (
        BIZ_COLLECTION_DETAIL_METADATA_STYLE_BASES.has(styleBase) &&
        isBizCareOrCollectionListing(
          product.name,
          productSlugLower,
          "category" in product ? product.category : null,
        )
      ) {
        const n = colorOptionsEffective.length;
        const gi = colorOptionsEffective.findIndex((c) => isBizCollectionDetailMetadataColourChip(c));
        if (gi >= 0) {
          colorOptionsEffective = colorOptionsEffective.filter(
            (c) => !isBizCollectionDetailMetadataColourChip(c),
          );
          const m = normalizedImageUrls.length;
          if (n > 1 && m % n === 0) {
            const stride = m / n;
            const start = gi * stride;
            normalizedImageUrls = [
              ...normalizedImageUrls.slice(0, start),
              ...normalizedImageUrls.slice(start + stride),
            ];
          }
        }
      }
    }

    // Biz Care CID940U: drop placeholder chip `Teal/01` when gallery is evenly split per colour.
    {
      const fbStyle = fashionBizStyleCodeFromListing(product.name, productSlugLower);
      const styleBase = fbStyle ? fbStyle.replace(/-CLEARANCE$/i, "") : "";
      if (
        styleBase === "CID940U" &&
        isBizCareOrCollectionListing(
          product.name,
          productSlugLower,
          "category" in product ? product.category : null,
        )
      ) {
        const n = colorOptionsEffective.length;
        const gi = colorOptionsEffective.findIndex((c) => isBizCareCid940uExcludedColourChip(c));
        if (gi >= 0) {
          colorOptionsEffective = colorOptionsEffective.filter((c) => !isBizCareCid940uExcludedColourChip(c));
          const m = normalizedImageUrls.length;
          if (n > 1 && m % n === 0) {
            const stride = m / n;
            const start = gi * stride;
            normalizedImageUrls = [
              ...normalizedImageUrls.slice(0, start),
              ...normalizedImageUrls.slice(start + stride),
            ];
          }
        }
      }
    }

    // Yes Chef CH234M: drop `Black White Check` chip when gallery is evenly split per colour.
    {
      const ch234mMeta = {
        slug: productSlugLower,
        category: "category" in product ? product.category : null,
        description: dbDescription,
        supplier_name: supplierNameRaw || null,
      };
      if (isStorefrontYesChefCh234mPdp(product.name, ch234mMeta)) {
        const n = colorOptionsEffective.length;
        const gi = colorOptionsEffective.findIndex((c) => isYesChefCh234mExcludedColourChip(c));
        if (gi >= 0) {
          colorOptionsEffective = colorOptionsEffective.filter((c) => !isYesChefCh234mExcludedColourChip(c));
          const m = normalizedImageUrls.length;
          if (n > 1 && m % n === 0) {
            const stride = m / n;
            const start = gi * stride;
            normalizedImageUrls = [
              ...normalizedImageUrls.slice(0, start),
              ...normalizedImageUrls.slice(start + stride),
            ];
          }
        }
      }
    }

    // Biz Collection WP6008: colour list uses `{STYLE} / Colour` chip labels — show only the colour name.
    {
      const fbStyle = fashionBizStyleCodeFromListing(product.name, productSlugLower);
      const styleBase = fbStyle ? fbStyle.replace(/-CLEARANCE$/i, "") : "";
      if (
        styleBase === "WP6008" &&
        isBizCollectionListing(
          product.name,
          productSlugLower,
          "category" in product ? product.category : null,
        )
      ) {
        colorOptionsEffective = stripBizCollectionStyleSlashColorPrefix(colorOptionsEffective, styleBase);
      }
    }

    // Aussie Pacific: `sync-aussie-pacific-api.mjs` sorts colours alphabetically and concatenates gallery URLs in
    // that order — match storefront chip order so index ↔ gallery stays aligned even when DB rows drift.
    if (isAussiePacificCatalog && colorOptionsEffective.length >= 2) {
      colorOptionsEffective = [...colorOptionsEffective].sort((a, b) =>
        String(a).localeCompare(String(b)),
      );
    }

    // Blue Whale: when the first gallery image is clearly Yellow/Navy, make that the default selected colour.
    if ((supplierNameRaw ?? "").trim().toLowerCase() === "blue whale" && colorOptionsEffective.length >= 2) {
      const firstUrl = normalizedImageUrls[0] ?? "";
      const firstTail = String(firstUrl).split("/").pop() ?? String(firstUrl);
      let firstFile = firstTail;
      try {
        firstFile = decodeURIComponent(firstTail);
      } catch {
        firstFile = firstTail;
      }
      const firstUpper = firstFile.toUpperCase();
      const hasYellow = colorOptionsEffective.some((c) => /\byellow\b/i.test(c));
      const hasOrange = colorOptionsEffective.some((c) => /\borange\b/i.test(c));
      const firstLooksYellow = firstUpper.includes("FYN") || firstUpper.includes("YELLOW");
      if (hasYellow && hasOrange && firstLooksYellow) {
        colorOptionsEffective = [
          ...colorOptionsEffective.filter((c) => /\byellow\b/i.test(c)),
          ...colorOptionsEffective.filter((c) => !/\byellow\b/i.test(c)),
        ];
      }
    }

    // Bisley Apex TT01/TT02 images: align gallery order to colour chips to avoid swapped hero images.
    if (isBisleyCatalog && colorOptionsEffective.length === 2 && normalizedImageUrls.length >= 2) {
      const a = colorOptionsEffective[0]?.toLowerCase() ?? "";
      const b = colorOptionsEffective[1]?.toLowerCase() ?? "";
      const hasOrange = a.includes("orange") || b.includes("orange");
      const hasYellow = a.includes("yellow") || b.includes("yellow");
      const hasNavyPair =
        colorOptionsEffective.every((c) => /\/\s*navy\b/i.test(c)) &&
        normalizedImageUrls.some((u) => /_TT01/i.test(String(u))) &&
        normalizedImageUrls.some((u) => /_TT02/i.test(String(u)));
      if (hasOrange && hasYellow && hasNavyPair) {
        const tt01 = normalizedImageUrls.find((u) => /_TT01/i.test(String(u)));
        const tt02 = normalizedImageUrls.find((u) => /_TT02/i.test(String(u)));
        if (tt01 && tt02) {
          // Observed in catalog: TT01 is Yellow/Navy and TT02 is Orange/Navy.
          const first = a.includes("orange") ? tt02 : tt01;
          const second = a.includes("orange") ? tt01 : tt02;
          const rest = normalizedImageUrls.filter((u) => u !== tt01 && u !== tt02);
          normalizedImageUrls = [first, second, ...rest];
        }
      }
    }

    // Bisley Apex / taped combos sometimes mix TT tokens and literal colour words (e.g. `...TT04...` + `...-ORANGE-...`).
    // When the chips are Orange/Navy + Yellow/Navy, force the two images to follow that chip order.
    if (isBisleyCatalog && colorOptionsEffective.length === 2 && normalizedImageUrls.length === 2) {
      const wantsOrangeFirst = /orange/i.test(colorOptionsEffective[0] ?? "");
      const wantsYellowFirst = /yellow/i.test(colorOptionsEffective[0] ?? "");
      const isNavyCombo = colorOptionsEffective.every((c) => /\/\s*navy\b/i.test(String(c)));
      if (isNavyCombo && (wantsOrangeFirst || wantsYellowFirst)) {
        const classify = (u: string): "orange" | "yellow" | null => {
          const tail = String(u).split("/").pop() ?? String(u);
          let file = tail;
          try {
            file = decodeURIComponent(tail);
          } catch {
            file = tail;
          }
          const up = (file.split("?")[0] ?? file).toUpperCase();
          if (/\bORANGE\b/.test(up)) return "orange";
          if (/\bYELLOW\b/.test(up)) return "yellow";
          if (/\bTT02\b/.test(up)) return "orange";
          if (/\bTT01\b/.test(up)) return "yellow";
          if (/\bTT04\b/.test(up)) return "yellow";
          return null;
        };
        const aKind = classify(normalizedImageUrls[0] ?? "");
        const bKind = classify(normalizedImageUrls[1] ?? "");
        if (aKind && bKind && aKind !== bKind) {
          const correctFirst = wantsOrangeFirst ? "orange" : "yellow";
          if (aKind !== correctFirst) {
            normalizedImageUrls = [normalizedImageUrls[1]!, normalizedImageUrls[0]!];
          }
        }
      }
    }

    // Bisley BJ6730T/BJ6934T/BJL6078T/BK6989/BK6571: first image must be Yellow/Navy, second Orange/Navy.
    if (
      isBisleyCatalog &&
      (productSlugLower.includes("bj6730t") ||
        productSlugLower.includes("bj6934t") ||
        productSlugLower.includes("bjl6078t") ||
        productSlugLower.includes("bk6987t") ||
        productSlugLower.includes("bk6989") ||
        productSlugLower.includes("bk6571")) &&
      normalizedImageUrls.length === 2
    ) {
      colorOptionsEffective = ["Yellow/Navy", "Orange/Navy"];
      const classify = (u: string): "orange" | "yellow" | null => {
        const tail = String(u).split("/").pop() ?? String(u);
        let file = tail;
        try {
          file = decodeURIComponent(tail);
        } catch {
          file = tail;
        }
        const up = (file.split("?")[0] ?? file).toUpperCase();
        if (/\bORANGE\b/.test(up)) return "orange";
        if (/\bYELLOW\b/.test(up)) return "yellow";
        if (/\bTT02\b/.test(up)) return "orange";
        if (/\bTT01\b/.test(up)) return "yellow";
        if (/\bTT04\b/.test(up)) return "yellow";
        if (/\bTT05\b/.test(up)) return "orange";
        return null;
      };
      const aKind = classify(normalizedImageUrls[0] ?? "");
      const bKind = classify(normalizedImageUrls[1] ?? "");
      if (aKind && bKind && aKind !== bKind && aKind !== "yellow") {
        normalizedImageUrls = [normalizedImageUrls[1]!, normalizedImageUrls[0]!];
      }
    }

    // Bisley BP6412T: chip + image order must be Navy/Orange first, then Black/Yellow.
    const treatAsBisleyCatalog =
      isBisleyCatalog || supplierLc.includes("bisley") || productSlugLower.startsWith("bis-");
    if ((productSlugLower.includes("bp6412t") || productCodeUpper === "BP6412T") && treatAsBisleyCatalog && normalizedImageUrls.length >= 2) {
      const canonical = ["Navy/Orange", "Black/Yellow"];
      colorOptionsEffective = canonical;
      const classify = (u: string): "navy_orange" | "black_yellow" | null => {
        const tail = String(u).split("/").pop() ?? String(u);
        let file = tail;
        try {
          file = decodeURIComponent(tail);
        } catch {
          file = tail;
        }
        const up = (file.split("?")[0] ?? file).toUpperCase();
        const hasNavy = /\bBPCT\b/.test(up) || /\bNAVY\b/.test(up);
        const hasBlack = /\bBBLK\b/.test(up) || /\bBLACK\b/.test(up);
        const hasOrange = /\bBF61\b/.test(up) || /\bORANGE\b/.test(up);
        const hasYellow = /\bBF51\b/.test(up) || /\bYELLOW\b/.test(up);
        if (hasNavy && hasOrange) return "navy_orange";
        if (hasBlack && hasYellow) return "black_yellow";
        // BP6412T on myadmin.pipanz.com uses TT09 (Navy/Orange) and TT05 (Black/Yellow).
        if (/\bTT09\b/.test(up)) return "navy_orange";
        if (/\bTT05\b/.test(up)) return "black_yellow";
        return null;
      };
      const buckets = new Map<"navy_orange" | "black_yellow", string>();
      for (const u of normalizedImageUrls) {
        const k = classify(u);
        if (k && !buckets.has(k)) buckets.set(k, u);
      }
      const ordered = [buckets.get("navy_orange"), buckets.get("black_yellow")].filter(
        (u): u is string => Boolean(u),
      );
      if (ordered.length === 2) {
        const used = new Set(ordered);
        const rest = normalizedImageUrls.filter((u) => !used.has(u));
        normalizedImageUrls = [...ordered, ...rest];
      }
    }

    // JB's Wear: remove stray `Orange` chip (non-matching / not a real SKU colour).
    if (productSlugLower === "jb-6hvfh" || productSlugLower === "jb-6dpoh") {
      colorOptionsEffective = colorOptionsEffective.filter((c) => String(c).trim().toLowerCase() !== "orange");
    }

    // Bisley BJ6979T: first image must be Yellow, second Orange.
    if (isBisleyCatalog && productSlugLower.includes("bj6979t") && normalizedImageUrls.length === 2) {
      colorOptionsEffective = ["Yellow", "Orange"];
      const classify = (u: string): "orange" | "yellow" | null => {
        const tail = String(u).split("/").pop() ?? String(u);
        let file = tail;
        try {
          file = decodeURIComponent(tail);
        } catch {
          file = tail;
        }
        const up = (file.split("?")[0] ?? file).toUpperCase();
        if (/\bORANGE\b/.test(up)) return "orange";
        if (/\bYELLOW\b/.test(up)) return "yellow";
        return null;
      };
      const aKind = classify(normalizedImageUrls[0] ?? "");
      const bKind = classify(normalizedImageUrls[1] ?? "");
      if (aKind && bKind && aKind !== bKind && aKind !== "yellow") {
        normalizedImageUrls = [normalizedImageUrls[1]!, normalizedImageUrls[0]!];
      }
    }

    // Bisley BKL6975: first image Yellow/Navy, second Orange/Navy, third Pink/Navy.
    if (isBisleyCatalog && productSlugLower.includes("bkl6975") && normalizedImageUrls.length === 3) {
      const canonical = ["Yellow/Navy", "Orange/Navy", "Pink/Navy"];
      colorOptionsEffective = canonical;
      const classify = (u: string): "orange" | "yellow" | "pink" | null => {
        const tail = String(u).split("/").pop() ?? String(u);
        let file = tail;
        try {
          file = decodeURIComponent(tail);
        } catch {
          file = tail;
        }
        const up = (file.split("?")[0] ?? file).toUpperCase();
        if (/\bORANGE\b/.test(up)) return "orange";
        if (/\bYELLOW\b/.test(up)) return "yellow";
        if (/\bPINK\b/.test(up)) return "pink";
        if (/\bTT02\b/.test(up)) return "orange";
        if (/\bTT01\b/.test(up)) return "yellow";
        if (/\bTT04\b/.test(up)) return "yellow";
        if (/\bTT05\b/.test(up)) return "orange";
        if (/\bTT21\b/.test(up)) return "pink";
        return null;
      };
      const buckets = new Map<string, string>();
      for (const u of normalizedImageUrls) {
        const k = classify(u);
        if (k && !buckets.has(k)) {
          buckets.set(k, u);
        }
      }
      const ordered: string[] = [];
      const y = buckets.get("yellow");
      const o = buckets.get("orange");
      const p = buckets.get("pink");
      if (y) ordered.push(y);
      if (o) ordered.push(o);
      if (p) ordered.push(p);
      if (ordered.length === 3) {
        normalizedImageUrls = ordered;
      }
    }

    const bisleyPositionalStyleUpper = bisleyPositionalGalleryStyleUpperFromSlugOrName(
      productSlugLower,
      productCodeUpper,
    );

    // Bisley drill/shirt lines (BSC1820 family, etc.): CSV `available_colors` is sometimes wrong
    // (e.g. "BPCT / 01", "BSAND / 01") while `image_urls` has four assets. When all four positional
    // codes are detectable (basename or full URL), replace chip labels and reorder the gallery.
    if (isBisleyCatalog && bisleyPositionalStyleUpper !== "" && normalizedImageUrls.length >= 2) {
      const sortedStrict = bisleySortedPositionalImageUrlsIfComplete(normalizedImageUrls);
      if (sortedStrict) {
        colorOptionsEffective = [...BISLEY_POSITIONAL_GALLERY_COLOR_LABELS];
        normalizedImageUrls = sortedStrict;
      } else {
        const sortedByDb = bisleyReorderDrillImagesToMatchColors(normalizedImageUrls, colorOptionsEffective);
        if (sortedByDb) {
          normalizedImageUrls = sortedByDb;
        }
      }
    }

    // Bisley simple code filenames (e.g. BBEAN55_BBLK_…): reorder gallery to match colorOptions.
    if (isBisleyCatalog && normalizedImageUrls.length >= 2 && colorOptionsEffective.length >= 2) {
      const skipSimpleBisleyReorder = bisleyPositionalStyleUpper !== "";
      if (!skipSimpleBisleyReorder) {
        const colorByKey = new Map(colorOptionsEffective.map((c) => [compactColorDedupeKey(c), c]));
        const mapped: Array<{ url: string; key: string }> = [];
        for (const u of normalizedImageUrls) {
          const tail = String(u).split("/").pop() ?? String(u);
          let file = tail;
          try {
            file = decodeURIComponent(tail);
          } catch {
            file = tail;
          }
          const fileNoQuery = (file.split("?")[0] ?? file).trim();
          const label = bisleyDisplayColorFromImageFilename(fileNoQuery);
          if (!label) continue;
          const key = compactColorDedupeKey(label);
          if (!colorByKey.has(key)) continue;
          mapped.push({ url: u, key });
        }
        if (mapped.length >= 2) {
          // Prefer ordering chips to match the supplier image order when detectable.
          // This keeps "image order == chip order" for Bisley assets like `BS1526_SKY_01.jpg`.
          const imageKeyOrder = [...new Set(mapped.map((m) => m.key))];
          const orderedColorsFromImages = imageKeyOrder
            .map((k) => colorByKey.get(k))
            .filter((c): c is string => Boolean(c));
          if (orderedColorsFromImages.length >= 2) {
            const used = new Set(orderedColorsFromImages.map((c) => compactColorDedupeKey(c)));
            const restColors = colorOptionsEffective.filter((c) => !used.has(compactColorDedupeKey(c)));
            colorOptionsEffective = [...orderedColorsFromImages, ...restColors];
          }

          // If we have exactly one image per detected colour, treat the current URL order as canonical
          // and only reorder chips. (Otherwise, reorder images so the hero/gallery aligns to chip order.)
          const counts = new Map<string, number>();
          for (const m of mapped) counts.set(m.key, (counts.get(m.key) ?? 0) + 1);
          const hasOnePerColor = counts.size >= 2 && [...counts.values()].every((n) => n === 1);
          if (!hasOnePerColor) {
            const used = new Set(mapped.map((m) => m.url));
            const byKey = new Map(mapped.map((m) => [m.key, m.url]));
            const ordered = colorOptionsEffective
              .map((c) => byKey.get(compactColorDedupeKey(c)))
              .filter((u): u is string => Boolean(u));
            if (ordered.length >= 2) {
              const rest = normalizedImageUrls.filter((u) => !used.has(u));
              normalizedImageUrls = [...ordered, ...rest];
            }
          }
        }
      }
    }

    // Bisley shirts like BS1526/BS6526: keep a stable canonical ordering.
    // Observed: Sky + White + Midnight + Sand assets use codes like BPLB/BWHT/BDKN/BPEY.
    if (isBisleyCatalog && normalizedImageUrls.length >= 4 && colorOptionsEffective.length >= 4) {
      const canonical = ["Sky", "White", "Midnight", "Sand"];
      const canonicalKeys = canonical.map(compactColorDedupeKey);
      const presentKeys = new Set(colorOptionsEffective.map(compactColorDedupeKey));
      const hasAllCanonical = canonicalKeys.every((k) => presentKeys.has(k));
      if (hasAllCanonical) {
        const byKey = new Map<string, string>();
        for (const u of normalizedImageUrls) {
          const tail = String(u).split("/").pop() ?? String(u);
          let file = tail;
          try {
            file = decodeURIComponent(tail);
          } catch {
            file = tail;
          }
          const fileNoQuery = (file.split("?")[0] ?? file).trim();
          const label = bisleyDisplayColorFromImageFilename(fileNoQuery);
          if (!label) continue;
          const k = compactColorDedupeKey(label);
          if (!presentKeys.has(k)) continue;
          if (!byKey.has(k)) byKey.set(k, u);
        }
        const orderedUrls = canonicalKeys.map((k) => byKey.get(k)).filter((u): u is string => Boolean(u));
        if (orderedUrls.length === canonical.length) {
          const used = new Set(orderedUrls);
          const rest = normalizedImageUrls.filter((u) => !used.has(u));
          normalizedImageUrls = [...orderedUrls, ...rest];
          colorOptionsEffective = [...canonical, ...colorOptionsEffective.filter((c) => !canonicalKeys.includes(compactColorDedupeKey(c)))];
        }
      }
    }

    // Syzmik ZJ260: supplier folder includes `ZJ260_Product_Multi_…` (pack/lifestyle) — not a real colour.
    if (productSlugLower.includes("zj260")) {
      colorOptionsEffective = colorOptionsEffective.filter(
        (c) => String(c).trim().toLowerCase() !== "multi",
      );
    }

    // Bisley BPC8580/BPC8580T: DB colour chip shows "Orange" but should be "Navy".
    if (isBisleyCatalog && (productSlugLower.includes("bpc8580") || productSlugLower.includes("bpc8580t"))) {
      colorOptionsEffective = colorOptionsEffective.map((c) =>
        String(c).trim().toLowerCase() === "orange" ? "Navy" : c,
      );
    }

    // Bisley BSHC1333 / BSH1331: ensure chip order matches image order
    // (Black, Charcoal, Green, Navy, Stone).
    if (
      isBisleyCatalog &&
      (productSlugLower.includes("bshc1333") || productSlugLower.includes("bsh1331")) &&
      colorOptionsEffective.length >= 5
    ) {
      const canonical = ["Black", "Charcoal", "Green", "Navy", "Stone"];
      // Only override when we have these colours present (avoid hiding new colours).
      const have = new Set(colorOptionsEffective.map((c) => String(c).trim().toLowerCase()));
      const can = canonical.every((c) => have.has(c.toLowerCase()));
      if (can) {
        colorOptionsEffective = canonical;
      }
      if (normalizedImageUrls.length >= 5) {
        const classify = (u: string): string | null => {
          const tail = String(u).split("/").pop() ?? String(u);
          let file = tail;
          try {
            file = decodeURIComponent(tail);
          } catch {
            file = tail;
          }
          const up = (file.split("?")[0] ?? file).toUpperCase();
          if (/\bBBLK\b/.test(up) || /\bBLACK\b/.test(up)) return "Black";
          if (/\bBCCG\b/.test(up) || /\bCHARCOAL\b/.test(up)) return "Charcoal";
          if (/\bBGRN\b/.test(up) || /\bGREEN\b/.test(up)) return "Green";
          if (/\bBPCT\b/.test(up) || /\bNAVY\b/.test(up)) return "Navy";
          if (/\bBSTN\b/.test(up) || /\bSTONE\b/.test(up)) return "Stone";
          return null;
        };
        const buckets = new Map<string, string>();
        for (const u of normalizedImageUrls) {
          const k = classify(u);
          if (k && !buckets.has(k)) buckets.set(k, u);
        }
        const ordered = canonical.map((c) => buckets.get(c)).filter((u): u is string => Boolean(u));
        if (ordered.length >= 5) {
          normalizedImageUrls = ordered;
        }
      }
    }

    // Bisley BSHC1332: ensure chip order matches image order (Black, Green, Navy, Stone).
    if (isBisleyCatalog && productSlugLower.includes("bshc1332") && colorOptionsEffective.length >= 4) {
      const canonical = ["Black", "Green", "Navy", "Stone"];
      const have = new Set(colorOptionsEffective.map((c) => String(c).trim().toLowerCase()));
      const can = canonical.every((c) => have.has(c.toLowerCase()));
      if (can) {
        colorOptionsEffective = canonical;
      }
      if (normalizedImageUrls.length >= 4) {
        const classify = (u: string): string | null => {
          const tail = String(u).split("/").pop() ?? String(u);
          let file = tail;
          try {
            file = decodeURIComponent(tail);
          } catch {
            file = tail;
          }
          const up = (file.split("?")[0] ?? file).toUpperCase();
          if (/\bBBLK\b/.test(up) || /\bBLACK\b/.test(up)) return "Black";
          if (/\bBGRN\b/.test(up) || /\bGREEN\b/.test(up)) return "Green";
          if (/\bBPCT\b/.test(up) || /\bNAVY\b/.test(up)) return "Navy";
          if (/\bBSTN\b/.test(up) || /\bSTONE\b/.test(up)) return "Stone";
          return null;
        };
        const buckets = new Map<string, string>();
        for (const u of normalizedImageUrls) {
          const k = classify(u);
          if (k && !buckets.has(k)) buckets.set(k, u);
        }
        const ordered = canonical.map((c) => buckets.get(c)).filter((u): u is string => Boolean(u));
        if (ordered.length >= 4) {
          normalizedImageUrls = ordered;
        }
      }
    }

    if (
      isBizCollectionP29012Listing({
        slug: product.slug ?? null,
        name: product.name,
        supplierName: supplierNameRaw || null,
      })
    ) {
      colorOptionsEffective = applyBizCollectionP29012ColorDisplayRules(colorOptionsEffective);
    }

    if (isAussiePacificCatalog && isStorefrontAp2211Slug(productSlugLower)) {
      colorOptionsEffective = filterAp2211ColorOptions(colorOptionsEffective);
    }

    if (isAussiePacificCatalog && isStorefrontAp3309Slug(productSlugLower)) {
      colorOptionsEffective = filterAp3309ColorOptions(colorOptionsEffective);
    }

    if (isAussiePacificCatalog && isStorefrontAp2311Slug(productSlugLower)) {
      colorOptionsEffective = filterAp2311ColorOptions(colorOptionsEffective);
    }

    if (
      isAussiePacificCatalog &&
      isStorefrontAp2310Slug(productSlugLower) &&
      normalizedImageUrls.some((u) => urlLooksLikeAp2310BackAsset(String(u)))
    ) {
      normalizedImageUrls = repositionAp2310BlackRedBackAfterSeventh(normalizedImageUrls);
    }

    let apColorImageCounts: number[] | null = null;
    if (isAussiePacificCatalog && normalizedImageUrls.length > 0) {
      const apGallery = resolveApPdpGalleryState(
        normalizedImageUrls,
        productSlugLower,
        colorOptionsEffective,
      );
      normalizedImageUrls = apGallery.imageUrls;
      apColorImageCounts = apGallery.apColorImageCounts;
    }

    if (isJbWearCatalog) {
      const styleFromName = product.name.trim().match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/)?.[1];
      const styleUpper =
        jbStyleCodeUpperFromProductSlug(productSlugLower) ??
        (styleFromName ? styleFromName.toUpperCase().replace(/-CLEARANCE$/i, "") : null);
      const jb7pip = applyJb7pipBlackRedFirstPdp(
        styleUpper,
        colorOptionsEffective,
        normalizedImageUrls,
        jbPrefixCount,
      );
      colorOptionsEffective = jb7pip.colors;
      normalizedImageUrls = jb7pip.imageUrls;
    }

    const sizeOptionsEffective = normalizeProductSizeOptions(
      product.available_sizes,
      product.name,
      "slug" in product ? product.slug : null,
      "category" in product ? product.category : null,
    );
    const productSlugForMeta = product.slug?.trim() ? product.slug : slug;
    const supplierLowerEarly = supplierNameRaw.toLowerCase();
    const isDncProduct = isDncCatalog;
    const dncDisplayPreview = isDncProduct
      ? productCardDisplayLines(
          product.name,
          dbDescription,
          productSlugForMeta,
          supplierNameRaw || null,
          colorOptionsEffective,
          false,
          sizeOptionsEffective,
        )
      : null;
    const dncDescriptionFallback =
      isDncProduct && !effectivePdpDescription && !dbDescription
        ? buildDncProductDescription({
            productName: dncDisplayPreview?.productName ?? product.name,
            styleCode: dncDisplayPreview?.productCode ?? null,
            category: product.category ?? inferCategoryFromName(product.name),
            colors: colorOptionsEffective,
            sizes: sizeOptionsEffective,
          })
        : null;

    const mappedProduct: ProductDetailData = {
      id: product.id,
      name: product.name,
      slug: productSlugForMeta,
      category: product.category ?? inferCategoryFromName(product.name),
      ...(supplierNameRaw ? { supplierName: supplierNameRaw } : {}),
      description:
        effectivePdpDescription ??
        dbDescription ??
        dncDescriptionFallback ??
        "Reliable workwear configured for your branding needs.",
      basePrice: Math.round(basePrice * 100) / 100,
      ...((manualSale != null || discountPercent > 0) && { originalPrice: listRetail }),
      imageUrls: normalizedImageUrls,
      colorOptions: colorOptionsEffective,
      ...(apColorImageCounts ? { apColorImageCounts } : {}),
      sizeOptions: sizeOptionsEffective,
      ...(googleRating ? { googleRating } : {}),
      ...(dbFeatures ? { features: dbFeatures } : {}),
      ...(dbSpecifications ? { specifications: dbSpecifications } : {}),
      ...(relatedProducts.length ? { relatedProducts } : {}),
    };

    const { productName: displayProductName, productCode: displayProductCode } = productCardDisplayLines(
      mappedProduct.name,
      mappedProduct.description,
      mappedProduct.slug,
      mappedProduct.supplierName ?? null,
      mappedProduct.colorOptions,
      false,
      mappedProduct.sizeOptions,
    );

    const slugLower = String(mappedProduct.slug ?? "").trim().toLowerCase();
    const supplierLower = String(mappedProduct.supplierName ?? "").trim().toLowerCase();
    const fromName = storefrontLeadingSupplierBrand(mappedProduct.name);
    const fromSupplierName = mappedProduct.supplierName?.trim() ? mappedProduct.supplierName.trim() : null;
    const inferredFromSlug =
      slugLower.startsWith("fb-syzmik-") || slugLower.includes("syzmik")
        ? "Syzmik"
        : slugLower.startsWith("bis-") || slugLower.includes("bisley")
          ? "Bisley"
          : slugLower.startsWith("jb-") || slugLower.includes("jbswear")
            ? "JB's Wear"
            : slugLower.startsWith("dnc-")
              ? "DNC Workwear"
              : null;
    const brand = fromName ?? fromSupplierName ?? inferredFromSlug;
    const displayBrandSkuLine =
      supplierLower === "aussie pacific" || slugLower.startsWith("ap-")
        ? `Aussie Pacific / ${displayProductCode}`
        : brand
          ? `${brand} / ${displayProductCode}`
          : displayProductCode;

    mappedProduct.displayProductName = displayProductName;
    mappedProduct.displayProductCode = displayProductCode;
    mappedProduct.displayBrandSkuLine = displayBrandSkuLine;
    mappedProduct.displayColorOptions = colorOptionsEffective;
    mappedProduct.pdpDescriptionBody = computePdpDescriptionBodyFromDetailFields({
      name: mappedProduct.name,
      description: mappedProduct.description,
      slug: mappedProduct.slug,
      supplierName: mappedProduct.supplierName,
      displayProductName,
      displayProductCode,
      colorOptions: mappedProduct.colorOptions,
      sizeOptions: mappedProduct.sizeOptions,
    });

    return {
      product: mappedProduct,
      placements: sortPlacementsForProductPage(
        normalizePlacementLabelsForStorefront(
          dedupePlacementsByStorefrontRole(
            mergePlacementsWithFallback(positions as PlacementData[] | null | undefined, fallbackPlacements),
          ),
        ),
      ),
    };
  } catch {
    return null;
  }
}

/** Cached PDP payload — repeat views / metadata share one Supabase+rating pass per ~2 min. */
export async function getDetailData(
  slugParam: string,
): Promise<{ product: ProductDetailData; placements: PlacementData[] } | null> {
  const slug = normalizeRouteSlug(slugParam);
  if (!slug) {
    return null;
  }
  // Dev: avoid stale `unstable_cache` causing colour chip / gallery mismatches while iterating.
  if (process.env.NODE_ENV !== "production") {
    return await getDetailDataInternal(slug);
  }
  return unstable_cache(
    async () => getDetailDataInternal(slug),
    /** Bump segment when PDP payload must refresh immediately after catalog imports (see `import:jbswear`, etc.). */
    ["storefront-pdp-v35", slug],
    { revalidate: 120, tags: ["storefront-pdp"] },
  )();
}

function formatUsdMeta(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Link / search snippets: use storefront retail (same as `getDetailData`), not raw supplier `base_price`. */
/** Shared SEO fields (canonical path, images, brand, sku) derived from a product. */
function productSeoFields(product: ProductDetailData) {
  const urlPath = `/products/${encodeURIComponent(
    productPathSegment({ name: product.name, slug: product.slug ?? null }),
  )}`;
  const images = resolveStorefrontImageUrlList(product.imageUrls).slice(0, 6);
  const brand = (() => {
    const line = String(product.displayBrandSkuLine ?? "").trim();
    if (line.includes("/")) {
      const b = line.split("/")[0]?.trim();
      if (b) return b;
    }
    return product.supplierName?.trim() || null;
  })();
  const sku = String(product.displayProductCode ?? "").trim() || null;
  return { urlPath, images, brand, sku };
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getDetailData(slug);
  if (!detail) {
    return { title: "Product" };
  }
  const { product } = detail;
  const colorOpts = product.colorOptions ?? [];
  const displayLines =
    product.displayProductName != null || product.displayProductCode != null
      ? {
          productName: product.displayProductName ?? null,
          productCode: String(product.displayProductCode ?? "").trim(),
        }
      : productCardDisplayLines(
          product.name,
          product.description,
          product.slug,
          product.supplierName ?? null,
          colorOpts,
          false,
          product.sizeOptions,
        );
  const titleCore = (displayLines.productName?.trim() ? displayLines.productName : product.name).trim();
  const title =
    bisleyPdpDisplayProductNameWithApexPrefix(
      displayLines.productName ?? titleCore,
      displayLines.productCode,
      product.supplierName ?? null,
      product.slug ?? null,
      product.name,
    ) ?? titleCore;
  const sale = product.basePrice;
  const was = product.originalPrice;
  const pricePhrase =
    was != null ? `List ${formatUsdMeta(was)} · from ${formatUsdMeta(sale)}` : `From ${formatUsdMeta(sale)}`;
  const plainDesc = (product.description ?? "").replace(/\s+/g, " ").trim();
  const clipped = plainDesc.length > 140 ? `${plainDesc.slice(0, 137)}…` : plainDesc;
  const description = clipped.length > 0 ? `${pricePhrase}. ${clipped}` : pricePhrase;

  const seo = productSeoFields(product);
  return {
    title,
    description,
    alternates: { canonical: seo.urlPath },
    openGraph: {
      title,
      description,
      type: "website",
      url: seo.urlPath,
      ...(seo.images.length ? { images: seo.images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(seo.images.length ? { images: seo.images } : {}),
    },
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const detailData = await getDetailData(slug);

  if (!detailData) {
    notFound();
  }

  const seoProduct = detailData.product;
  const seo = productSeoFields(seoProduct);
  const seoProductName = (
    seoProduct.displayProductName?.trim() ? seoProduct.displayProductName : seoProduct.name
  ).trim();
  const seoDescription = (seoProduct.description ?? "").replace(/\s+/g, " ").trim().slice(0, 5000);
  const productLd = productJsonLd({
    name: seoProductName,
    description: seoDescription,
    url: seo.urlPath,
    images: seo.images,
    sku: seo.sku,
    brand: seo.brand,
    price: seoProduct.basePrice,
    availability: "InStock",
    rating: seoProduct.googleRating
      ? { value: seoProduct.googleRating.rating, count: seoProduct.googleRating.userRatingsTotal }
      : null,
  });
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: seoProductName, url: seo.urlPath },
  ]);

  return (
    <>
      <JsonLd data={productLd} />
      <JsonLd data={breadcrumbLd} />
      <TopNav />
      <PremiumWorkPoloClientDynamic
        product={detailData.product}
        placements={detailData.placements}
        serverPdpDescriptionBody={computePdpDescriptionBodyFromDetailFields({
          name: detailData.product.name,
          description: detailData.product.description,
          slug: detailData.product.slug ?? null,
          supplierName: detailData.product.supplierName,
          displayProductName: detailData.product.displayProductName,
          displayProductCode: detailData.product.displayProductCode,
          colorOptions: detailData.product.colorOptions ?? [],
          sizeOptions: detailData.product.sizeOptions ?? [],
        })}
      />
    </>
  );
}

import { parseBasePrice } from "@/lib/product-price";
import { isBizCareListingInMiscGeneratedSet } from "@/lib/biz-care-misc-route";
import bizCollectionKidsOnlyJacketsCodes from "@/lib/biz-collection-kids-only-jackets.json";
import bizCollectionKidsOnlyPantsCodes from "@/lib/biz-collection-kids-only-pants.json";
import bizCollectionKidsOnlyTShirtsCodes from "@/lib/biz-collection-kids-only-t-shirts.json";
import {
  fashionBizListingGenderAudience,
  fashionBizListingKidsOnlyTshirtMatched,
  isBizCareOrCollectionListing,
  isBizCollectionListing,
  listingCodeMatchesKidsOnlyTshirt,
} from "@/lib/fashion-biz-gender-route";
import { FASHION_BIZ_STYLE_GENDER } from "@/lib/fashion-biz-gender.generated";
import { FASHION_BIZ_LISTING_SUBSLUG } from "@/lib/fashion-biz-listing-subslug.generated";
import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import { resolveHealthCareBrowseSubSlug } from "@/lib/health-care-browse";

const WORKWEAR_MAIN_SLUG = "workwear";
const MENS_MAIN_SLUG = "mens";
const WOMENS_MAIN_SLUG = "womens";
const KIDS_MAIN_SLUG = "kids";

const BIZ_COLLECTION_KIDS_ONLY_JACKETS_CODES = new Set(
  (bizCollectionKidsOnlyJacketsCodes as readonly string[]).map((c) => c.toUpperCase()),
);

const BIZ_COLLECTION_KIDS_ONLY_PANTS_CODES = new Set(
  (bizCollectionKidsOnlyPantsCodes as readonly string[]).map((c) => c.toUpperCase()),
);

const BIZ_COLLECTION_KIDS_ONLY_T_SHIRTS_CODES = new Set(
  (bizCollectionKidsOnlyTShirtsCodes as readonly string[]).map((c) => c.toUpperCase()),
);

/** Biz Collection SKUs that only appear under Kid's (jackets / pants / t-shirts kids lines). */
function isBizCollectionKidsExclusiveListing(productName: string, storeSlug?: string | null): boolean {
  if (!productName.toLowerCase().includes("biz collection")) {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, storeSlug);
  if (!code) {
    return false;
  }
  return (
    BIZ_COLLECTION_KIDS_ONLY_JACKETS_CODES.has(code) ||
    BIZ_COLLECTION_KIDS_ONLY_PANTS_CODES.has(code) ||
    BIZ_COLLECTION_KIDS_ONLY_T_SHIRTS_CODES.has(code)
  );
}
const PPE_MAIN_SLUG = "ppe";
const PPE_MISCELLANEOUS_SUB_SLUG = "miscellaneous";
const PPE_HEAD_WEAR_SUB_SLUG = "head-wear";
const CHEF_MAIN_SLUG = "chef";

function jbCatalogSubslugForVisibility(slug: string): string | null {
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

function jbStyleCodeTailFromSlug(slug: string): string | null {
  const seg = jbCatalogSubslugForVisibility(slug);
  if (!seg?.startsWith("jb-")) {
    return null;
  }
  const rest = seg.slice(3);
  const parts = rest.split("-").filter(Boolean);
  const tail = parts.length ? parts[parts.length - 1] : "";
  if (/^[a-z0-9]{3,20}$/i.test(tail)) {
    return tail.toUpperCase();
  }
  const compact = rest.replace(/-/g, "").toUpperCase();
  return compact.length > 0 ? compact : null;
}

function jbStyleCodeUpperFromListing(productName: string, meta?: Pick<WorkwearOnlyBrandMeta, "slug">): string | null {
  const fromSlug = jbStyleCodeTailFromSlug(String(meta?.slug ?? ""));
  if (fromSlug) {
    return fromSlug.toUpperCase().replace(/-CLEARANCE$/i, "");
  }
  const m = String(productName).trim().match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/);
  return m ? m[1].toUpperCase().replace(/-CLEARANCE$/i, "") : null;
}

/**
 * JB rows that must appear only under PPE → Miscellaneous (never Chef, Workwear, Men's, … browse grids).
 */
const JB_PPE_MISCELLANEOUS_EXCLUSIVE_STYLE_CODES = new Set(
  ["8M001", "8M050", "9KPI", "8M055", "9EFB", "9KPE", "8P060", "8P085"].map((c) => c.toUpperCase()),
);

export function isJbPpeMiscellaneousExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const isJbRow =
    isJbWearSupplierName(meta?.supplier_name ?? null) ||
    jbCatalogSubslugForVisibility(String(meta?.slug ?? "")) != null;
  if (!isJbRow) {
    return false;
  }
  const code = jbStyleCodeUpperFromListing(productName, meta);
  return code != null && JB_PPE_MISCELLANEOUS_EXCLUSIVE_STYLE_CODES.has(code);
}

/**
 * JB's Wear styles whose catalogue code starts with `6` (e.g. 6RKB) — routed under Workwear instead of PPE Head Wear.
 */
export function isJbWearSixSeriesListing(
  productName: string,
  meta?: Pick<WorkwearOnlyBrandMeta, "slug" | "supplier_name">,
): boolean {
  const fromSlug = jbStyleCodeTailFromSlug(String(meta?.slug ?? ""));
  if (fromSlug?.startsWith("6")) {
    return true;
  }
  const sup = String(meta?.supplier_name ?? "").trim().toLowerCase();
  const isJbSupplier =
    sup === "jb's wear" ||
    sup === "jbs wear" ||
    sup === "jbswear" ||
    /\bjbs\s*wear\b/i.test(sup);
  if (!isJbSupplier) {
    return false;
  }
  const p = productName.trim().match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/);
  return Boolean(p && p[1].toUpperCase().startsWith("6"));
}

/**
 * Socks or PPE-style head wear (hats, helmets, balaclavas, …) — hide from Workwear JB's Wear grids;
 * rows may still appear under PPE (e.g. Head Wear / Miscellaneous) when routing allows.
 */
export function isJbWorkwearExcludedHeadwearOrSocks(
  productName: string,
  meta?: Pick<WorkwearOnlyBrandMeta, "category">,
): boolean {
  if (isSocksKeywordProduct(productName, meta)) {
    return true;
  }
  if (isHeadWearKeywordProduct(productName)) {
    return true;
  }
  const normalized = productName.toLowerCase();
  return (
    normalized.includes("head wear") ||
    normalized.includes("headwear") ||
    normalized.includes("helmet") ||
    normalized.includes("hardhat") ||
    normalized.includes("hard hat") ||
    normalized.includes("bump cap") ||
    normalized.includes("balaclava")
  );
}

/** Product names containing these (case-insensitive) are only listed under Workwear. */
const WORKWEAR_ONLY_BRANDS = ["syzmik", "bisley", "blue whale", "blue-whale", "bluewhale"] as const;

export type WorkwearOnlyBrandMeta = {
  slug?: string | null;
  category?: string | null;
  /** Used for storefront-only rules (e.g. style codes only in supplier description). */
  description?: string | null;
  /** Optional audience gate (products.audience). */
  audience?: string | null;
  /** Supplier/brand label from DB (products.supplier_name). */
  supplier_name?: string | null;
  /**
   * Admin-controlled flag to hide a product from the storefront without deleting it.
   * (DB column: `products.storefront_hidden`)
   */
  storefront_hidden?: boolean | null;
};

function normalizeAudience(raw?: string | null): "mens" | "womens" | "kids" | "unisex" | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) {
    return null;
  }
  if (s === "mens" || s === "men" || s === "male") {
    return "mens";
  }
  if (s === "womens" || s === "women" || s === "ladies" || s === "female") {
    return "womens";
  }
  if (s === "kids" || s === "kid" || s === "children" || s === "child") {
    return "kids";
  }
  if (s === "unisex") {
    return "unisex";
  }
  return null;
}

function workwearOnlyBrandSearchText(productName: string, meta?: WorkwearOnlyBrandMeta): string {
  const chunks = [
    productName.trim(),
    meta?.slug?.trim() ?? "",
    meta?.category?.trim() ?? "",
    meta?.supplier_name?.trim() ?? "",
  ].filter((s) => s.length > 0);
  return chunks.join(" ").toLowerCase();
}

const T10032_SKU_RE = /(?:^|[^A-Za-z0-9])T10032(?:[A-Za-z]*)(?=$|[^A-Za-z0-9])/i;

/**
 * Kid-only tee T10032: name/slug/category, `fashionBizListingKidsOnlyTshirtMatched`, or description when
 * no other style code contradicts (shared supplier blurbs mention T10032 on many rows).
 */
export function isKidsOnlyTshirtT10032Product(
  productName: string,
  meta?: Pick<WorkwearOnlyBrandMeta, "slug" | "category" | "description">,
): boolean {
  const hayNc = [productName, meta?.slug ?? "", meta?.category ?? ""].join("\n");
  if (T10032_SKU_RE.test(hayNc)) {
    return true;
  }
  if (fashionBizListingKidsOnlyTshirtMatched(productName, meta?.slug ?? null)) {
    return true;
  }
  const desc = meta?.description ?? "";
  if (desc.length === 0 || !T10032_SKU_RE.test(desc)) {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code && !listingCodeMatchesKidsOnlyTshirt(code)) {
    return false;
  }
  return true;
}

/** Match workwear-only brands in display name, store slug, or category text. */
export function isWorkwearOnlyBrandProduct(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const n = workwearOnlyBrandSearchText(productName, meta);
  return WORKWEAR_ONLY_BRANDS.some((mark) => n.includes(mark));
}

/** Fashion Biz `images/Syzmik/…` catalog rows (sync uses "Syzmik {SKU}" names). */
export function isSyzmikCatalogProduct(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  return workwearOnlyBrandSearchText(productName, meta).includes("syzmik");
}

/** Bisley catalog rows (importers set name like "... (B71407)" and supplier_name to Bisley). */
export function isBisleyCatalogProduct(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const sn = String(meta?.supplier_name ?? "").trim().toLowerCase();
  if (sn) {
    return sn.includes("bisley");
  }
  return workwearOnlyBrandSearchText(productName, meta).includes("bisley");
}

function isBisleyBb101Listing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!isBisleyCatalogProduct(productName, meta)) {
    return false;
  }
  const hay = `${productName} ${meta?.slug ?? ""}`.toUpperCase();
  return /\bBB101\b/.test(hay);
}

function isBisleyBs6404Listing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!isBisleyCatalogProduct(productName, meta)) {
    return false;
  }
  const hay = `${productName} ${meta?.slug ?? ""}`.toUpperCase();
  return /\bBS6404\b/.test(hay);
}

const BISLEY_MENS_PANTS_EXCLUSIVE_STYLE_CODES = new Set(
  ["BS021M", "BS10112R", "BS10112S"].map((c) => c.toUpperCase()),
);

/** Bisley SKUs that must appear only under Men's/Pants (never Workwear or any other category browse). */
export function isBisleyMensPantsExclusiveListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!isBisleyCatalogProduct(productName, meta)) {
    return false;
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of BISLEY_MENS_PANTS_EXCLUSIVE_STYLE_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

const BISLEY_WOMENS_PANTS_EXCLUSIVE_STYLE_CODES = new Set(
  [
    "BBS2605L",
    "BS022L",
    "BS10322",
    "BS612SBS911L",
    "BS29320",
    "BS29323",
    "BS506L",
    "BS507L",
    "BS508L",
    "BS730L",
    "BS734L",
    "BS909L",
    "TP226L",
  ].map((c) => c.toUpperCase()),
);

/**
 * Bisley (or TP…) SKUs that must appear only under Women's/Pants (never Workwear or any other browse grid).
 * Includes explicit style codes plus Bisley pant tokens ending in `LS` / `LT` (long / long-tall lines).
 */
export function isBisleyWomensPantsExclusiveListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;

  for (const raw of BISLEY_WOMENS_PANTS_EXCLUSIVE_STYLE_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      continue;
    }
    if (raw.startsWith("TP")) {
      return true;
    }
    if (isBisleyCatalogProduct(productName, meta)) {
      return true;
    }
  }

  if (!isBisleyCatalogProduct(productName, meta)) {
    return false;
  }
  // Men's/Pants Bisley lines coded …LS / …LT → Women's/Pants only.
  if (/\b(?:BBS|BS|TP)\d+[A-Z]*(?:LS|LT)\b/i.test(hay)) {
    return true;
  }
  return false;
}

function womensPantListingLooksBottomWeighted(
  hayLower: string,
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (/\b(pants?|trousers?|shorts?|denim|drill|jogger|joggers|overall|overalls?|slack|chino|cargo|bottom)\b/.test(hayLower)) {
    return true;
  }
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    const sub = FASHION_BIZ_LISTING_SUBSLUG[base] ?? FASHION_BIZ_LISTING_SUBSLUG[`${base}-CLEARANCE`] ?? null;
    if (sub === "pants") {
      return true;
    }
  }
  const cat = String(meta?.category ?? "").toLowerCase();
  return /\b(pants?|trousers?|shorts?)\b/.test(cat);
}

/**
 * Women's / ladies' bottoms that still surface under Men's/Pants — Women's/Pants only (never other mains or subs).
 * Uses DB audience, Fashion Biz gender, title/category copy, JB Ladies, Bisley/Syzmik + women's wording, and
 * unisex Biz pants rows whose copy clearly targets women.
 */
export function isWomensPantLinesExclusiveToWomensPantsOnlyListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (isWomensPantsForceMensStyleCode(productName, meta)) {
    return false;
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`.toLowerCase();
  const womensWord = /\b(ladies|lady|women|women's|womens|female)\b/.test(hay);
  const norm = normalizeAudience(meta?.audience ?? null);
  if (norm === "womens") {
    return womensPantListingLooksBottomWeighted(hay, productName, meta);
  }
  const fb = fashionBizListingGenderAudience(productName, meta?.slug ?? null, meta?.category ?? null);
  if (fb === "womens") {
    return womensPantListingLooksBottomWeighted(hay, productName, meta);
  }
  if (isJbWearSupplierName(meta?.supplier_name ?? null) && isJbLadiesListing(productName, meta)) {
    return womensPantListingLooksBottomWeighted(hay, productName, meta);
  }
  if (womensWord && womensPantListingLooksBottomWeighted(hay, productName, meta)) {
    return true;
  }
  const workTxt = workwearOnlyBrandSearchText(productName, meta);
  const wl = workTxt.toLowerCase();
  if ((wl.includes("bisley") || wl.includes("syzmik")) && womensWord && womensPantListingLooksBottomWeighted(hay, productName, meta)) {
    return true;
  }
  if (isBizCareOrCollectionListing(productName, meta?.slug ?? null, meta?.category ?? null) && fb === "mens" && womensWord) {
    const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
    if (code) {
      const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
      const sub = FASHION_BIZ_LISTING_SUBSLUG[base] ?? FASHION_BIZ_LISTING_SUBSLUG[`${base}-CLEARANCE`] ?? null;
      const rawG =
        FASHION_BIZ_STYLE_GENDER[base] ?? FASHION_BIZ_STYLE_GENDER[`${base}-CLEARANCE`] ?? null;
      if (sub === "pants" && rawG === "unisex") {
        return true;
      }
    }
  }
  return false;
}

const BIZ_COLLECTION_WOMENS_SHIRTS_EXCLUSIVE_STYLE_CODES = new Set(
  [
    "K315LS",
    "K624LS",
    "K625LS",
    "K819LS",
    "K819LT",
    "S626LL",
    "S627LN",
    "S628LS",
    "S828LL",
  ].map((c) => c.toUpperCase()),
);

/** Biz Care / Biz Collection SKUs that must appear only under Women's/Shirts (never Workwear or any other browse grid). */
export function isBizCollectionWomensShirtsExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (!isBizCareOrCollectionListing(productName, meta?.slug ?? null, meta?.category ?? null)) {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (BIZ_COLLECTION_WOMENS_SHIRTS_EXCLUSIVE_STYLE_CODES.has(base)) {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of BIZ_COLLECTION_WOMENS_SHIRTS_EXCLUSIVE_STYLE_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

function isWomensCardiganListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const hay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""}`.toLowerCase();
  if (!/\bcardigan\b/.test(hay)) {
    return false;
  }
  const aud = normalizeAudience(meta?.audience ?? null);
  if (aud === "womens") {
    return true;
  }
  // Fallback: many supplier titles encode women's lines in the name.
  return /\b(ladies|lady|women|women's|womens)\b/.test(hay);
}

function isJbWearSupplierName(supplierName: string | null | undefined): boolean {
  const s = String(supplierName ?? "").trim().toLowerCase();
  return (
    s === "jb's wear" ||
    s === "jbs wear" ||
    s === "jbswear" ||
    /\bjbs\s*wear\b/i.test(s)
  );
}

/** JB's Wear style BJ6962 — Workwear/Miscellaneous browse only (no other main or sub). */
export function isWorkwearJb6962MiscExclusiveListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  if (!/\bBJ6962\b/i.test(hay)) {
    return false;
  }
  if (isJbWearSupplierName(meta?.supplier_name ?? null)) {
    return true;
  }
  const n = productName.toLowerCase();
  return /\bjb'?s\s+wear\b/i.test(n) || /\bjbs\s*wear\b/i.test(n);
}

const WORKWEAR_MISC_TO_PANTS_EXCLUSIVE_STYLE_CODES = new Set(
  ["6MCP", "BPU6110", "BP6474T", "BP6474", "BPL6022"].map((c) => c.toUpperCase()),
);

/** Misc-style codes that must list only under Workwear/Pants (no other main or Workwear sub). */
export function isWorkwearMiscToPantsExclusiveListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of WORKWEAR_MISC_TO_PANTS_EXCLUSIVE_STYLE_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

/** Coverall / overall(s) — Workwear/Coverall only on category browse (never other mains or subs). */
export function listingLooksLikeCoverallOverallGarment(
  productName: string,
  meta?: Pick<WorkwearOnlyBrandMeta, "slug" | "category" | "description"> | WorkwearOnlyBrandMeta | null,
): boolean {
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`.toLowerCase();
  return (
    /\bcover\s*alls?\b/.test(hay) ||
    /\bcoveralls?\b/.test(hay) ||
    /\boveralls?\b/.test(hay)
  );
}

export function isWorkwearCoverallOverallExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  return listingLooksLikeCoverallOverallGarment(productName, meta);
}

/**
 * Waterproof jacket rows mis-filed under Workwear/Hi-vis Vest — Workwear/Jackets only (never other mains or subs).
 * Requires workwear / hi-vis context so casual rain jackets on Men's are not pulled in.
 */
export function isWorkwearWaterproofJacketExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const title = productName.toLowerCase();
  const cat = String(meta?.category ?? "").toLowerCase();
  const h = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${cat}`.toLowerCase();

  const hasWaterproofJacket =
    /\bwaterproof[\s/-]+jacket\b/.test(h) ||
    /\bjacket[\s/-]+waterproof\b/.test(h) ||
    (/\bwaterproof\b/.test(title) && /\bjacket\b/.test(title));

  if (!hasWaterproofJacket) {
    return false;
  }

  const hvHay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`.toLowerCase();
  const hasHvToken = /\bhv\b/.test(hvHay) || /\bhi[\s-]*vis\b/.test(hvHay) || /\bhigh[\s-]*vis\b/.test(hvHay);

  return (
    isJbWearSupplierName(meta?.supplier_name ?? null) ||
    isSyzmikCatalogProduct(productName, meta) ||
    isBisleyCatalogProduct(productName, meta) ||
    hasHvToken ||
    cat.includes("hi-vis") ||
    cat.includes("hi vis") ||
    cat.includes("high vis") ||
    cat.includes("vest") ||
    cat.includes("workwear") ||
    cat.includes("safety") ||
    /\b(hi[\s-]*vis|high[\s-]*vis|hv\b|safety\s+vest|reflective|rail)\b/.test(h)
  );
}

function isJbHiVisVestListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (isWorkwearWaterproofJacketExclusiveListing(productName, meta)) {
    return false;
  }
  if (!isJbWearSupplierName(meta?.supplier_name ?? null)) {
    return false;
  }
  const hay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`.toLowerCase();
  // Requested exception: knit vests should list under Men's/Jumper.
  if (/\b6atv\b/.test(hay) || /\b6v\b/.test(hay)) {
    return false;
  }
  // Requested: move all JB vests out of PPE/Misc and into Workwear/Hi-vis Vest.
  // (Also matches the earlier "Hv+Vest" token.)
  return /\bvests?\b/.test(hay) || /\bhv\+vest\b/i.test(hay);
}

function isJbKnitVestMensJumperListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!isJbWearSupplierName(meta?.supplier_name ?? null)) {
    return false;
  }
  const hay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`.toLowerCase();
  if (!/\b(6atv|6v)\b/.test(hay)) {
    return false;
  }
  return /\b(knit|knitted)\b/.test(hay) && /\bvest\b/.test(hay);
}

function isHiVisHvListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const hay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`.toLowerCase();
  // "Hv" token in catalog titles, plus common spellings.
  return /\bhv\b/.test(hay) || /\bhi[\s-]*vis\b/.test(hay) || /\bhigh[\s-]*vis\b/.test(hay);
}

function isJbHiVisListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!isJbWearSupplierName(meta?.supplier_name ?? null)) {
    return false;
  }
  return isHiVisHvListing(productName, meta);
}

/** JB jacket/outerwear text — avoids treating Hi-Vis polos/tees as jacket exclusives. */
function isJbJacketLikeListingText(hayLower: string): boolean {
  if (/\bpolo\b/.test(hayLower) && !/\bjacket\b/.test(hayLower)) {
    return false;
  }
  if (/\b(t-?shirts?|tee|crew\s*neck)\b/.test(hayLower) && !/\bjacket\b/.test(hayLower)) {
    return false;
  }
  if (/\bjacket\b/.test(hayLower)) {
    return true;
  }
  if (/\b(softshell|hardshell|windbreaker|bomber|parka|anorak|spray\s*jacket|rain\s*jacket)\b/.test(hayLower)) {
    return true;
  }
  if (/\b(fleece|polar|hoodie|fleecy)\b/.test(hayLower) && /\b(full\s*zip|zip|hooded|hoodie|jacket)\b/.test(hayLower)) {
    return true;
  }
  if (/\b(coats?|outerwear)\b/.test(hayLower)) {
    return true;
  }
  return false;
}

/** JB knit/fleece-style text — used so Hi-Vis rows in Men's/Jumper route to Workwear/Jumper, not Jackets. */
function isJbJumperLikeListingText(hayLower: string): boolean {
  if (
    /\b(softshell|hardshell|windbreaker|bomber|parka|anorak)\b/.test(hayLower) &&
    !/\b(fleece|hoodie|hoody|pullover|jumper|sweatshirt|sweater|polar|fleecy)\b/.test(hayLower)
  ) {
    return false;
  }
  return (
    /\b(fleece|hoodie|hoody|pullover|sweatshirt|jumper|sweater|polar|fleecy|knit(?:ted)?)\b/.test(hayLower) ||
    /\b(?:1\/2\s*zip|half\s*zip|quarter\s*zip|1\/4\s*zip)\b/.test(hayLower) ||
    /\bjumpers?\b/.test(hayLower)
  );
}

/**
 * JB's Wear jacket-class rows with Hv / Hi Vis / High Vis or style token `6DVRL` — Workwear/Jackets only
 * (never Men's or Women's Jackets, or any other main/sub). Hi-vis vests stay on Workwear/Hi-vis Vest.
 */
export function isJbHiVisOr6dvrlWorkwearJacketsExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (!isJbWearSupplierName(meta?.supplier_name ?? null)) {
    return false;
  }
  if (isJbHiVisVestListing(productName, meta)) {
    return false;
  }
  const hay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`;
  const hayLower = hay.toLowerCase();
  const has6dvrl = /\b6dvrl\b/i.test(hay);
  const hasHiVis = isHiVisHvListing(productName, meta);
  if (!has6dvrl && !hasHiVis) {
    return false;
  }
  if (has6dvrl) {
    return true;
  }
  if (isJbJumperLikeListingText(hayLower)) {
    return false;
  }
  return isJbJacketLikeListingText(hayLower);
}

/**
 * JB's Wear jumper-class rows with Hv / Hi Vis / High Vis or style tokens `6DAQF` / `6DARF` — Workwear/Jumper only
 * (never Men's/Women's Jumper or any other main/sub). Hi-vis vests stay on Workwear/Hi-vis Vest.
 */
export function isJbHiVisOr6daqf6darfWorkwearJumperExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (!isJbWearSupplierName(meta?.supplier_name ?? null)) {
    return false;
  }
  if (isJbHiVisVestListing(productName, meta)) {
    return false;
  }
  const hay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`;
  const hayLower = hay.toLowerCase();
  const has6daqf = /\b6daqf\b/i.test(hay);
  const has6darf = /\b6darf\b/i.test(hay);
  const hasHiVis = isHiVisHvListing(productName, meta);
  if (!has6daqf && !has6darf && !hasHiVis) {
    return false;
  }
  if (has6daqf || has6darf) {
    return true;
  }
  return isJbJumperLikeListingText(hayLower);
}

const JB_MENS_PANTS_TO_WORKWEAR_PANTS_STYLE_TOKENS = ["6DFP", "6DPRP", "6MT", "6MDNT", "6SCJ"].map((t) =>
  t.toUpperCase(),
);

function jbMensPantsListingLooksLikeBottomsGarment(hayLower: string): boolean {
  return (
    /\b(pants?|trousers?|shorts?|denim|drill|jogger|joggers|overalls?)\b/.test(hayLower) || /\bcargo\b/.test(hayLower)
  );
}

/**
 * JB's Wear Men's/Pants rows (reflective / cargo / Multi Pkt / listed `6…` style tails) — Workwear/Pants only
 * (never Men's/Women's Pants or any other main/sub).
 */
export function isJbMensPantsFeaturesToWorkwearPantsExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (!isJbWearSupplierName(meta?.supplier_name ?? null)) {
    return false;
  }
  const blob = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`;
  const bl = blob.toLowerCase();
  for (const tok of JB_MENS_PANTS_TO_WORKWEAR_PANTS_STYLE_TOKENS) {
    const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(blob)) {
      return true;
    }
  }
  if (!jbMensPantsListingLooksLikeBottomsGarment(bl)) {
    return false;
  }
  if (/\breflective\b/.test(bl)) {
    return true;
  }
  if (/\bcargo\b/.test(bl)) {
    return true;
  }
  if (/\bmulti\s+pkts?\b/.test(bl) || /\bmulti[\s-]*pkt\b/.test(bl)) {
    return true;
  }
  return false;
}

/** Style `S3FSZ` (often filed under Men's/Pants) — Men's/Jumper only (never other mains or subs). */
export function isMensPantsS3fszMensJumperExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (base === "S3FSZ") {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  return /\bS3FSZ\b/i.test(hay);
}

/** Style `WV619M` (often Men's/Jackets) — Men's/Jumper only (never other mains or subs). */
export function isWv619mMensJumperExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (base === "WV619M") {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  return /\bWV619M\b/i.test(hay);
}

/** Style `TP3160B` (often filed under Men's/Pants) — Kid's/Pants only (never other mains or subs). */
export function isTp3160bKidsPantsExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (base === "TP3160B") {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  return /\bTP3160B\b/i.test(hay);
}

const JB_WORKWEAR_POLOS_EXCLUSIVE_STYLE_CODES = new Set(
  ["6SPPL", "6SPPS", "6HSSP", "6HSSR"].map((c) => c.toUpperCase()),
);

/** JB `6SPPL` / `6SPPS` / `6HSSP` / `6HSSR` (often Men's/Polos) — Workwear/Polos only (never other mains or subs). */
export function isJbSixSpplWorkwearPolosExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (JB_WORKWEAR_POLOS_EXCLUSIVE_STYLE_CODES.has(base)) {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of JB_WORKWEAR_POLOS_EXCLUSIVE_STYLE_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

/** Style `6DARL` (often Men's/Jackets) — Workwear/Jackets only (never other mains or subs). */
export function isJb6darlWorkwearJacketsExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (base === "6DARL") {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  return /\b6DARL\b/i.test(hay);
}

/** Text/slug/category heuristics aligned with `resolveProductSubSlug` polo + rugby routing. */
function listingLooksLikePolosGarment(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`.toLowerCase();
  if (/\bpolo\b/.test(hay) && !/\bpoloneck\b/.test(hay)) {
    return true;
  }
  if (
    /\brugby\b/.test(hay) &&
    !/\bshorts?\b/.test(hay) &&
    !/\b(pant|pants|trouser|trousers|jogger|joggers|overalls?)\b/.test(hay)
  ) {
    return true;
  }
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  return FASHION_BIZ_LISTING_SUBSLUG[base] === "polos";
}

/**
 * Biz Care/Collection kid polo lines where the title omits "polo" — still Fashion-Biz `kids` audience (KS polos, P7700B, …).
 * Excludes kid-only jackets/pants/tees handled elsewhere.
 */
function isKidsAudienceBizPoloByStyleCode(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const slug = meta?.slug ?? null;
  const category = meta?.category ?? null;
  if (!isBizCareOrCollectionListing(productName, slug, category)) {
    return false;
  }
  if (fashionBizListingGenderAudience(productName, slug, category) !== "kids") {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, slug);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  if (
    BIZ_COLLECTION_KIDS_ONLY_JACKETS_CODES.has(base) ||
    BIZ_COLLECTION_KIDS_ONLY_PANTS_CODES.has(base) ||
    BIZ_COLLECTION_KIDS_ONLY_T_SHIRTS_CODES.has(base)
  ) {
    return false;
  }
  if (base === "P7700B" || base.includes("KS")) {
    return true;
  }
  return FASHION_BIZ_LISTING_SUBSLUG[base] === "polos";
}

/**
 * Kid-line polos that file under Men's/Polos — Kid's/Polos only (never other mains or subs).
 * Kid-only tees (T10032 / *KS tees / …) stay on Kid's/T-shirts via existing rules.
 */
export function isKidsLinePolosExclusiveCategoryBrowseListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (isKidsOnlyTshirtT10032Product(productName, meta)) {
    return false;
  }
  const slug = meta?.slug ?? null;
  const category = meta?.category ?? null;
  const code = fashionBizStyleCodeFromListing(productName, slug);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (BIZ_COLLECTION_KIDS_ONLY_T_SHIRTS_CODES.has(base)) {
      return false;
    }
  }

  const poloLike = listingLooksLikePolosGarment(productName, meta) || isKidsAudienceBizPoloByStyleCode(productName, meta);
  if (!poloLike) {
    return false;
  }

  if (normalizeAudience(meta?.audience ?? null) === "kids") {
    return true;
  }
  if (fashionBizListingGenderAudience(productName, slug, category) === "kids") {
    return true;
  }

  const n = productName.toLowerCase();
  const cat = String(category ?? "").toLowerCase();
  const kidWords =
    /\b(kids|kid's|kid\s|children|child|youth|junior|boys?|girls?|infants?|toddlers?)\b/i;
  if (kidWords.test(n) || kidWords.test(cat)) {
    return true;
  }
  return false;
}

/** Text/slug/category + Fashion Biz subslug — aligned with common Men's/Jackets browse rows. */
function listingLooksLikeJacketsGarment(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`.toLowerCase();
  if (
    /\b(jacket|jackets|coat|coats|blazer|parka|anorak|windbreaker|bomber|outerwear|hoodie|hoody|shell)\b/i.test(
      hay,
    ) ||
    (/\bfleece\b/i.test(hay) && /\b(jacket|coat|hood|zip|pullover)\b/i.test(hay))
  ) {
    if (/\bpolo\b/.test(hay) && !/\b(jacket|coat|parka|shell|outerwear)\b/i.test(hay)) {
      return false;
    }
    return true;
  }
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  return FASHION_BIZ_LISTING_SUBSLUG[base] === "jackets";
}

/**
 * Biz Care/Collection kid jacket lines where the title omits "jacket" — CSV `kids` + jacket subslug or kid-only jacket codes.
 */
function isKidsAudienceBizJacketByStyleCode(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const slug = meta?.slug ?? null;
  const category = meta?.category ?? null;
  if (!isBizCareOrCollectionListing(productName, slug, category)) {
    return false;
  }
  if (fashionBizListingGenderAudience(productName, slug, category) !== "kids") {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, slug);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  if (BIZ_COLLECTION_KIDS_ONLY_PANTS_CODES.has(base) || BIZ_COLLECTION_KIDS_ONLY_T_SHIRTS_CODES.has(base)) {
    return false;
  }
  if (BIZ_COLLECTION_KIDS_ONLY_JACKETS_CODES.has(base)) {
    return true;
  }
  return FASHION_BIZ_LISTING_SUBSLUG[base] === "jackets";
}

/**
 * Kid-line jackets that file under Men's/Jackets — Kid's/Jackets only (never other mains or subs).
 * Kid-only tees / pants-only SKUs stay on their existing Kid's routes (`T10032`, TP3160B, …).
 */
export function isKidsLineJacketsExclusiveCategoryBrowseListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (isKidsOnlyTshirtT10032Product(productName, meta)) {
    return false;
  }
  if (isTp3160bKidsPantsExclusiveListing(productName, meta)) {
    return false;
  }
  const slug = meta?.slug ?? null;
  const category = meta?.category ?? null;
  const code = fashionBizStyleCodeFromListing(productName, slug);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (BIZ_COLLECTION_KIDS_ONLY_T_SHIRTS_CODES.has(base) || BIZ_COLLECTION_KIDS_ONLY_PANTS_CODES.has(base)) {
      return false;
    }
  }

  const jacketLike =
    listingLooksLikeJacketsGarment(productName, meta) || isKidsAudienceBizJacketByStyleCode(productName, meta);
  if (!jacketLike) {
    return false;
  }

  if (normalizeAudience(meta?.audience ?? null) === "kids") {
    return true;
  }
  if (fashionBizListingGenderAudience(productName, slug, category) === "kids") {
    return true;
  }

  const n = productName.toLowerCase();
  const cat = String(category ?? "").toLowerCase();
  const kidWords =
    /\b(kids|kid's|kid\s|children|child|youth|junior|boys?|girls?|infants?|toddlers?)\b/i;
  if (kidWords.test(n) || kidWords.test(cat)) {
    return true;
  }
  return false;
}

const WOMENS_JACKETS_J236ML_3WSJ1_EXCLUSIVE_STYLE_CODES = new Set(
  ["J236ML", "3WSJ1"].map((c) => c.toUpperCase()),
);

/** `J236ML` / `3WSJ1` (often Men's/Jackets) — Women's/Jackets only (never other mains or subs). */
export function isWomensJacketsJ236ml3wsj1ExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (WOMENS_JACKETS_J236ML_3WSJ1_EXCLUSIVE_STYLE_CODES.has(base)) {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of WOMENS_JACKETS_J236ML_3WSJ1_EXCLUSIVE_STYLE_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

const KIDS_JACKETS_J307K_J3150B_J740K_EXCLUSIVE_STYLE_CODES = new Set(
  ["J307K", "J3150B", "J740K"].map((c) => c.toUpperCase()),
);

/** `J307K` / `J3150B` / `J740K` (often Men's/Jackets) — Kid's/Jackets only (never other mains or subs). */
export function isKidsJacketsJ307kJ3150bJ740kExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (KIDS_JACKETS_J307K_J3150B_J740K_EXCLUSIVE_STYLE_CODES.has(base)) {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of KIDS_JACKETS_J307K_J3150B_J740K_EXCLUSIVE_STYLE_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

function isStreetPolosListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const hay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`.toLowerCase();
  // "street" / "streetworx" lines should live under Workwear.
  return /\bstreetworx\b/.test(hay) || /\bstreet\b/.test(hay);
}

function isWorkwearShirtsKeywordListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const hay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`.toLowerCase();
  return (
    /\bhv\b/.test(hay) ||
    /\bhi[\s-]*vis\b/.test(hay) ||
    /\bhigh[\s-]*vis\b/.test(hay) ||
    /\bwork\s*shirts?\b/.test(hay) ||
    /\bwork-?shirts?\b/.test(hay) ||
    /\bwork\s*shirt\b/.test(hay) ||
    /\breflective\b/.test(hay)
  );
}

function isWorkwearJacketsKeywordListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const hay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`.toLowerCase();
  return (
    /\brail\b/.test(hay) ||
    /\broad\b/.test(hay) ||
    /\breflective\b/.test(hay) ||
    /\bhv\b/.test(hay) ||
    /\bhi[\s-]*vis\b/.test(hay) ||
    /\bhigh[\s-]*vis\b/.test(hay)
  );
}

function isFashionBizMensMsMlListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const u = code.toUpperCase();
  return u.endsWith("MS") || u.endsWith("ML");
}

function isFashionBizMensMOrMnListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const u = code.toUpperCase();
  // Size/gender suffixes used by some Fashion Biz lines.
  return u.endsWith("MN") || (u.endsWith("M") && !u.endsWith("WM") && !u.endsWith("FM"));
}

/**
 * Women's/T-shirts browse: hide rows that read as men's when DB `audience` is empty or ambiguous.
 * (MS/ML + M/MN style codes are handled separately — same as Polos/Jackets.)
 */
function isMensLeanTeeTextOrAudienceForWomensTshirtsBrowse(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (fashionBizListingGenderAudience(productName, meta?.slug ?? null, meta?.category ?? null) === "mens") {
    return true;
  }
  if (normalizeAudience(meta?.audience ?? null) === "mens") {
    return true;
  }
  const hay = [productName, meta?.slug ?? "", meta?.category ?? ""]
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .join("\n")
    .toLowerCase();
  if (/\b(women|women's|womens|ladies|lady|female)\b/.test(hay)) {
    return false;
  }
  if (/\b(kids|kid's|children|child|boys|girls)\b/.test(hay)) {
    return false;
  }
  if (/\b(men's|mens)\b/.test(hay)) {
    return true;
  }
  if (/\bfor men\b/.test(hay)) {
    return true;
  }
  if (/\b(male fit|men's fit|mens fit)\b/.test(hay)) {
    return true;
  }
  return false;
}

/** Longer codes first so `1LSNC` wins over `1LS` prefix. */
const WOMENS_TSHIRTS_EXCLUDED_STYLE_CODES_SORTED = [
  "T10012",
  "S1NFT",
  "1LSNC",
  "1LST",
  "1TI",
  "7PNFT",
  "7PLFT",
  "7KBS2",
  "7STT",
  "7PS",
  "1JT",
  "1LS",
  "1S",
  "1HT",
  "1VT",
].map((c) => c.toUpperCase());

function listingCodeMatchesWomensTshirtsExcludedBase(parsedCode: string): boolean {
  const u = parsedCode.toUpperCase().replace(/-CLEARANCE$/i, "");
  for (const raw of WOMENS_TSHIRTS_EXCLUDED_STYLE_CODES_SORTED) {
    if (u === raw) {
      return true;
    }
    if (u.startsWith(raw) && u.length > raw.length) {
      const rest = u.slice(raw.length);
      if (/^[A-Z]+$/.test(rest)) {
        return true;
      }
    }
  }
  return false;
}

/** Requested: these SKUs must not appear under Women's/T-shirts (still allowed elsewhere, e.g. Men's). */
function isWomensTshirtsExcludedSkuListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code && listingCodeMatchesWomensTshirtsExcludedBase(code)) {
    return true;
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of WOMENS_TSHIRTS_EXCLUDED_STYLE_CODES_SORTED) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}[A-Z]*\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

/** Longer codes first (extend with multi-token exclusions if needed). */
const WOMENS_JUMPER_EXCLUDED_STYLE_CODES_SORTED = ["6ATV"].map((c) => c.toUpperCase());

function listingCodeMatchesWomensJumperExcludedBase(parsedCode: string): boolean {
  const u = parsedCode.toUpperCase().replace(/-CLEARANCE$/i, "");
  for (const raw of WOMENS_JUMPER_EXCLUDED_STYLE_CODES_SORTED) {
    if (u === raw) {
      return true;
    }
    if (u.startsWith(raw) && u.length > raw.length) {
      const rest = u.slice(raw.length);
      if (/^[A-Z]+$/.test(rest)) {
        return true;
      }
    }
  }
  return false;
}

/** Requested: these SKUs must not appear under Women's/Jumper (other mains/subs unchanged). */
function isWomensJumperExcludedSkuListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code && listingCodeMatchesWomensJumperExcludedBase(code)) {
    return true;
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of WOMENS_JUMPER_EXCLUDED_STYLE_CODES_SORTED) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}[A-Z]*\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

function isBizCollectionMensJacketListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!productName.toLowerCase().includes("biz collection")) {
    return false;
  }
  // CSV-driven audience routing: treat `unisex` as Men's; this matches how Men's/Women's browse splits Biz rows.
  return fashionBizListingGenderAudience(productName, meta?.slug ?? null, meta?.category ?? null) === "mens";
}

const WOMENS_POLOS_FORCE_MENS_STYLE_CODES = new Set(
  ["P10112", "P2100", "P29012", "P3200", "P3300", "P7700", "P9000", "P9900"].map((c) => c.toUpperCase()),
);

const WOMENS_SHIRTS_FORCE_MENS_STYLE_CODES = new Set(
  [
    "S10112",
    "S10210",
    "S10510",
    "S10512",
    "S29510",
    "SH112",
    "SH113",
    "SH3603",
    "SH714",
    "SH715",
    "SH816",
    "SH817",
    "40S",
    "4P",
    "6ESS1",
    "6E",
    "4PUL",
    "4MSI",
    "4M",
  ].map((c) => c.toUpperCase()),
);

/** Longer tokens first so `6ESS1` wins over `6E`, `4PUL` over `4P`. */
const MENS_SHIRTS_EXCLUSIVE_FROM_WOMENS_SHIRTS_SORTED = [...WOMENS_SHIRTS_FORCE_MENS_STYLE_CODES].sort(
  (a, b) => b.length - a.length,
);

const WOMENS_JACKETS_FORCE_MENS_STYLE_CODES = new Set(
  [
    "F10510",
    "J10110",
    "J10910",
    "J3150",
    "J3880",
    "J3881",
    "J3887",
    "PF380",
    "PF630",
    "SW239ML",
    "WP10310",
    "WP6008",
    "WV6007",
  ].map((c) => c.toUpperCase()),
);

/** JB-style chef jacket SKUs: list under Chef/Jackets only (not Women's/Men's → Jackets). */
const CHEF_JACKETS_FORCE_STYLE_CODES = new Set(["5CJ1", "5CJL1", "5CJ21", "5CJS1"].map((c) => c.toUpperCase()));

/** Listed SKUs — Chef/Miscellaneous only (never Chef/Tops `jackets`, Men's/Women's, or other subs). */
const CHEF_MISCELLANEOUS_EXCLUSIVE_JB_STYLE_CODES = new Set(
  ["5BT", "5KB", "5CVC", "5FC", "CH235"].map((c) => c.toUpperCase()),
);

export function isChefMiscellaneousExclusiveJbStyleListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (CHEF_MISCELLANEOUS_EXCLUSIVE_JB_STYLE_CODES.has(base)) {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of CHEF_MISCELLANEOUS_EXCLUSIVE_JB_STYLE_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

/** Women's browse: these style codes list under Women's/Jumper instead of Women's/Jackets. */
const WOMENS_JACKETS_FORCE_WOMENS_JUMPER_STYLE_CODES = new Set(
  ["F10520", "SW760L", "3FH1", "3HJ1", "3JLV1", "3PZH1"].map((c) => c.toUpperCase()),
);

/** Women's/Pants → Men's/Pants only (Bisley/JB-style titles may omit Fashion Biz name prefix). */
const WOMENS_PANTS_FORCE_MENS_STYLE_CODES = new Set(
  ["BS29110", "BS29210", "BS720M", "ST511M", "3PFC", "6SCS", "7NSS", "7NPSS"].map((c) => c.toUpperCase()),
);

function isWomensPantsForceMensStyleCode(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (WOMENS_PANTS_FORCE_MENS_STYLE_CODES.has(base)) {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of WOMENS_PANTS_FORCE_MENS_STYLE_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

/** Used by category browse to remap `jackets` → `jumper` under Women's. */
export function isWomensJacketsForceWomensJumperStyleCode(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  return WOMENS_JACKETS_FORCE_WOMENS_JUMPER_STYLE_CODES.has(base);
}

function isFashionBizForceMensPolosCode(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  return WOMENS_POLOS_FORCE_MENS_STYLE_CODES.has(base);
}

const FASHION_BIZ_POLOS_WOMENS_EXCLUSIVE_EXACT_CODES = new Set(
  ["P10122", "P2125", "P29022", "P3225", "P9025", "P9925"].map((c) => c.toUpperCase()),
);

/** Biz Care/Collection polos that must list only under Women's/Polos (LS/LL polo SKUs + listed P codes). */
export function isFashionBizPolosWomensExclusiveListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!isBizCareOrCollectionListing(productName, meta?.slug ?? null, meta?.category ?? null)) {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  if (FASHION_BIZ_POLOS_WOMENS_EXCLUSIVE_EXACT_CODES.has(base)) {
    return true;
  }
  if (!base.endsWith("LS") && !base.endsWith("LL")) {
    return false;
  }
  const sub =
    FASHION_BIZ_LISTING_SUBSLUG[base] ?? FASHION_BIZ_LISTING_SUBSLUG[`${base}-CLEARANCE`] ?? null;
  return sub === "polos";
}

const FASHION_BIZ_SHIRTS_WOMENS_EXCLUSIVE_EXACT_CODES = new Set(
  [
    "LB3600",
    "LB3601",
    "LB6200",
    "LB6201",
    "LB7300",
    "LB7301",
    "LB8200",
    "LB7301LB8200",
    "S10521",
    "S29520",
    "S29521",
    "S29522",
  ].map((c) => c.toUpperCase()),
);

/** Biz Care/Collection shirts that must list only under Women's/Shirts (LS/LL/LT + listed LB/S codes). */
export function isFashionBizShirtsWomensExclusiveListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!isBizCareOrCollectionListing(productName, meta?.slug ?? null, meta?.category ?? null)) {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  if (FASHION_BIZ_SHIRTS_WOMENS_EXCLUSIVE_EXACT_CODES.has(base)) {
    return true;
  }
  if (!base.endsWith("LS") && !base.endsWith("LL") && !base.endsWith("LT")) {
    return false;
  }
  const sub =
    FASHION_BIZ_LISTING_SUBSLUG[base] ?? FASHION_BIZ_LISTING_SUBSLUG[`${base}-CLEARANCE`] ?? null;
  return sub === "shirts";
}

const FASHION_BIZ_MENS_JACKETS_TO_WOMENS_SHIRTS_EXACT_CODES = new Set(
  [
    "J10920",
    "J134M",
    "J29123",
    "J3825",
    "J510M",
    "J833",
    "LC3505",
    "LC8008",
    "PF631",
    "PF905",
  ].map((c) => c.toUpperCase()),
);

/** Biz Care/Collection SKUs that must list only under Women's/Jumper (not Men's/Jumper or any other grid). */
const FASHION_BIZ_MENS_TO_WOMENS_JUMPER_EXACT_CODES = new Set(
  ["LC916L", "LP3506", "LP618L", "LV3504"].map((c) => c.toUpperCase()),
);

/**
 * Biz Care/Collection jacket SKUs that were surfacing under Men's/Jackets but must list only under
 * Women's/Shirts (never other mains or subs). Includes explicit style codes plus ladies-line codes
 * ending in a single `L` (see suffix helper).
 */
export function isFashionBizMensJacketsToWomensShirtsExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (!isBizCareOrCollectionListing(productName, meta?.slug ?? null, meta?.category ?? null)) {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  if (FASHION_BIZ_MENS_TO_WOMENS_JUMPER_EXACT_CODES.has(base)) {
    return false;
  }
  if (FASHION_BIZ_MENS_JACKETS_TO_WOMENS_SHIRTS_EXACT_CODES.has(base)) {
    return true;
  }
  const sub =
    FASHION_BIZ_LISTING_SUBSLUG[base] ?? FASHION_BIZ_LISTING_SUBSLUG[`${base}-CLEARANCE`] ?? null;
  if (sub !== "jackets") {
    return false;
  }
  return isFashionBizJacketsLadiesLineTrailingL(base);
}

/** Ladies-line `…L` jacket codes (single trailing `L`, excluding LL / size-style XL / ML, …). */
function isFashionBizJacketsLadiesLineTrailingL(base: string): boolean {
  if (base.length < 2 || !base.endsWith("L")) {
    return false;
  }
  if (base.endsWith("LL")) {
    return false;
  }
  for (const suf of ["5XL", "4XL", "3XL", "2XL", "XL"] as const) {
    if (base.endsWith(suf)) {
      return false;
    }
  }
  if (base.endsWith("ML") || base.endsWith("LM")) {
    return false;
  }
  const prev = base[base.length - 2]!;
  if (prev === "L") {
    return false;
  }
  return /[A-Z0-9]/i.test(prev);
}

/** Biz Care/Collection styles (e.g. surfaced under Men's/Jumper) — Women's/Jumper only. */
export function isFashionBizMensJumperToWomensJumperExclusiveListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (!isBizCareOrCollectionListing(productName, meta?.slug ?? null, meta?.category ?? null)) {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (FASHION_BIZ_MENS_TO_WOMENS_JUMPER_EXACT_CODES.has(base)) {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of FASHION_BIZ_MENS_TO_WOMENS_JUMPER_EXACT_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

function isFashionBizForceMensShirtsCode(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    for (const raw of MENS_SHIRTS_EXCLUSIVE_FROM_WOMENS_SHIRTS_SORTED) {
      if (base === raw) {
        return true;
      }
      if (base.startsWith(raw) && base.length > raw.length) {
        const rest = base.slice(raw.length);
        if (/^[A-Z]+$/.test(rest)) {
          return true;
        }
      }
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of MENS_SHIRTS_EXCLUSIVE_FROM_WOMENS_SHIRTS_SORTED) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}[A-Z]*\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

function isFashionBizForceMensJacketsCode(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  return WOMENS_JACKETS_FORCE_MENS_STYLE_CODES.has(base);
}

/** JB / supplier titles often include style codes without `Biz Care …` / slug `bizcare-*` segments. */
export function isChefJacketsForcedStyleCode(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (code) {
    const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
    if (CHEF_JACKETS_FORCE_STYLE_CODES.has(base)) {
      return true;
    }
  }
  const hay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}\n${meta?.category ?? ""}`;
  for (const raw of CHEF_JACKETS_FORCE_STYLE_CODES) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(hay)) {
      return true;
    }
  }
  return false;
}

function isJbLadiesListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!isJbWearSupplierName(meta?.supplier_name ?? null)) {
    return false;
  }
  const hay = `${productName} ${meta?.slug ?? ""} ${meta?.category ?? ""} ${meta?.description ?? ""}`.toLowerCase();
  return /\b(ladies|lady|women|women's|womens)\b/.test(hay);
}

/** Yes Chef / Yeschef hospitality listings — Chef main category only (not Men's / Women's). */
export function isYesChefCatalogProduct(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const blob = workwearOnlyBrandSearchText(productName, meta).toLowerCase();
  if (blob.includes("yes chef")) {
    return true;
  }
  return blob.replace(/[\s-]+/g, "").includes("yeschef");
}

function fashionBizListingChefSubForCode(code: string | null | undefined): boolean {
  if (code == null || !String(code).trim()) {
    return false;
  }
  const c = String(code).toUpperCase().trim();
  const sub = FASHION_BIZ_LISTING_SUBSLUG[c] ?? FASHION_BIZ_LISTING_SUBSLUG[`${c}-CLEARANCE`];
  return sub === "chef";
}

/**
 * Fashion Biz hospitality SKUs (e.g. `Biz Collection BA51 …`) map to listing sub-slug `chef` in
 * `FASHION_BIZ_LISTING_SUBSLUG` — storefront treats them like the Yes Chef / chef-wear line even when
 * the words “Yes Chef” never appear in the title.
 *
 * Also scans `BA##` / `BA##-CLEARANCE` in the title or slug when the primary parser misses (slug shape,
 * pasted SKUs in descriptions, etc.).
 */
export function isFashionBizChefLineListing(productName: string, storeSlug?: string | null): boolean {
  const primary = fashionBizStyleCodeFromListing(productName, storeSlug ?? null);
  if (fashionBizListingChefSubForCode(primary)) {
    return true;
  }
  const hay = `${productName} ${storeSlug ?? ""}`.toUpperCase();
  for (const m of hay.matchAll(/\b(BA\d{2})(?:-([A-Z0-9]+))?\b/g)) {
    const withSuffix = m[2] ? `${m[1]}-${m[2]}` : m[1];
    if (fashionBizListingChefSubForCode(withSuffix) || fashionBizListingChefSubForCode(m[1])) {
      return true;
    }
  }
  return false;
}

/** Syzmik lines with ZA in the display name → PPE / Miscellaneous (after ZW / ZWL overrides in `resolveProductSubSlug`). */
export function isSyzmikZaPpeMiscListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!isSyzmikCatalogProduct(productName, meta)) {
    return false;
  }
  return productName.toUpperCase().includes("ZA");
}

/** Fashion Biz `images/Biz Care/…` rows (sync uses "Biz Care {SKU}" names). */
export function isBizCareCatalogProduct(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  return workwearOnlyBrandSearchText(productName, meta).includes("biz care");
}

/**
 * Fashion Biz "Biz Corporates" catalog — delisted; hide everywhere on the storefront if rows remain in DB.
 * Matches display name, slug (`fb-bizcorporates-…`), etc.
 */
export function isBizCorporatesCatalogProduct(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const compact = workwearOnlyBrandSearchText(productName, meta).replace(/\s+/g, "");
  return compact.includes("bizcorporates") || compact.includes("bizcorporate");
}

/** Names or DB category imply socks → PPE → Miscellaneous only. */
export function isSocksKeywordProduct(
  productName: string,
  meta?: Pick<WorkwearOnlyBrandMeta, "category">,
): boolean {
  if (/\bsocks?\b/i.test(productName)) {
    return true;
  }
  const c = meta?.category?.toLowerCase() ?? "";
  return c.includes("sock");
}

/** Bags / totes / backpacks (name or category) → PPE → Miscellaneous only. */
export function isBagKeywordProduct(
  productName: string,
  meta?: Pick<WorkwearOnlyBrandMeta, "category">,
): boolean {
  if (/\b(bag|bags|tote|backpack|rucksack|satchel)\b/i.test(productName)) {
    return true;
  }
  const c = meta?.category?.toLowerCase() ?? "";
  return /\b(bag|bags|tote|backpack|rucksack|satchel)\b/.test(c) || c.includes("handbag");
}

/**
 * Hat / Cap / Beanie / Sun visor as whole words (avoids "that", "handicap", etc.).
 * Only listed under PPE → Head Wear.
 */
export function isHeadWearKeywordProduct(productName: string): boolean {
  if (/\bsun\s+visor\b/i.test(productName)) {
    return true;
  }
  if (/\bbeanie\b/i.test(productName)) {
    return true;
  }
  if (/\bhat\b/i.test(productName)) {
    return true;
  }
  if (/\bcap\b/i.test(productName)) {
    return true;
  }
  return false;
}

/**
 * Biz Care: hat / cap / beanie / visor / hijab etc. (product name or DB category) → PPE Miscellaneous.
 * Does not imply Biz Care brand; pair with `isBizCareCatalogProduct`.
 */
export function isBizCareHatLikeProduct(
  productName: string,
  meta?: Pick<WorkwearOnlyBrandMeta, "category">,
): boolean {
  if (isHeadWearKeywordProduct(productName)) {
    return true;
  }
  if (/\bhijab\b/i.test(productName) || /\bhead\s*scarf\b/i.test(productName)) {
    return true;
  }
  const c = meta?.category?.toLowerCase() ?? "";
  if (/\b(hat|hats|beanie|beanies|cap|caps|visor|hijab|headwear|head wear|turban|beret)\b/.test(c)) {
    return true;
  }
  if (c.includes("headwear") && !c.includes("helmet")) {
    return true;
  }
  return false;
}

/** Biz Care SKU: socks, bags, or hat-like → storefront Miscellaneous (PPE). */
export function isBizCareSocksBagOrHatMisc(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (!isBizCareCatalogProduct(productName, meta)) {
    return false;
  }
  return (
    isSocksKeywordProduct(productName, meta) ||
    isBagKeywordProduct(productName, meta) ||
    isBizCareHatLikeProduct(productName, meta)
  );
}

/**
 * Chef → Jackets grid: kitchen / chef outerwear only.
 * Generic work jackets stay under Men's or Women's → Jackets.
 */
export function isChefCategoryJacketListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const n = productName.toLowerCase();
  const cat = String(meta?.category ?? "").toLowerCase();
  const desc = String(meta?.description ?? "").toLowerCase();
  const blob = workwearOnlyBrandSearchText(productName, meta);

  if (blob.includes("yes chef")) {
    return true;
  }
  if (/\bchef(?:'s|s)?\b/i.test(productName)) {
    return true;
  }
  if (/\bcook\s+(coat|jacket)\b/i.test(n)) {
    return true;
  }
  if (/\bkitchen\s+(coat|jacket)\b/i.test(n)) {
    return true;
  }
  if ((cat.includes("chef") || cat.includes("chefwear")) && /\b(jacket|coat|blazer)\b/i.test(n)) {
    return true;
  }
  // JB's Wear: some hospitality/chef outerwear rows rely on DB category/description more than title.
  if (
    isJbWearSupplierName(meta?.supplier_name ?? null) &&
    (cat.includes("chef") || cat.includes("chefwear") || desc.includes("chef") || desc.includes("kitchen")) &&
    /\b(jacket|coat|blazer)\b/i.test(n)
  ) {
    return true;
  }
  return false;
}

/**
 * Chef-wear jacket lines (Yes Chef / JB chef / Fashion Biz `chef` bucket, …) — Chef/Jackets only on category browse.
 * Excludes chef trousers/aprons that still match loose "Yes Chef" jacket listing heuristics.
 */
export function isChefLineJacketsExclusiveCategoryBrowseListing(
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (isChefMiscellaneousExclusiveJbStyleListing(productName, meta)) {
    return false;
  }
  if (isChefJacketsForcedStyleCode(productName, meta)) {
    return true;
  }
  if (isFashionBizChefLineListing(productName, meta?.slug ?? null)) {
    if (isChefCategoryPantsListing(productName, meta)) {
      return false;
    }
    return listingLooksLikeJacketsGarment(productName, meta);
  }
  if (isChefCategoryJacketListing(productName, meta)) {
    if (isChefCategoryPantsListing(productName, meta) && !listingLooksLikeJacketsGarment(productName, meta)) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Chef → Pants grid: hospitality / kitchen trousers only.
 * Generic work pants stay under Men's or Women's → Pants.
 */
export function isChefCategoryPantsListing(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  const n = productName.toLowerCase();
  const cat = String(meta?.category ?? "").toLowerCase();
  const desc = String(meta?.description ?? "").toLowerCase();
  const blob = workwearOnlyBrandSearchText(productName, meta);

  const pantsLike =
    /\b(pant|pants|trouser|trousers|shorts?|jogger|joggers)\b/i.test(productName) ||
    /\b(pant|pants|trouser|trousers|shorts?)\b/.test(cat) ||
    /\b(pant|pants|trouser|trousers|shorts?|jogger|joggers)\b/i.test(desc);

  // Sync stores many Yes Chef lines as `category` = "Chef" with SKU-only titles; rely on description + supplier.
  const yesChef = isYesChefCatalogProduct(productName, meta);
  const pantsLikeForChefBrand =
    pantsLike || (yesChef && (cat.includes("chef") || cat.includes("pant")));

  if (!pantsLikeForChefBrand) {
    return false;
  }

  /** JB's Wear: Chef / Pants — `JB's LADIES ELASTICATED PANT CHECK - 06 (5CCP1)` only (style code 5CCP1). */
  const supplierLower = String(meta?.supplier_name ?? "").trim().toLowerCase();
  const isJbWearListing =
    supplierLower === "jb's wear" ||
    supplierLower === "jbs wear" ||
    supplierLower === "jbswear" ||
    /\bjb'?s\s+wear\b/i.test(productName) ||
    /\bjbs\s*wear\b/i.test(n);
  if (isJbWearListing) {
    const skuHay = `${productName}\n${meta?.slug ?? ""}\n${meta?.description ?? ""}`.toUpperCase();
    return skuHay.includes("5CCP1");
  }

  if (blob.includes("yes chef")) {
    return true;
  }
  if (/\bchef\b/i.test(productName)) {
    return true;
  }
  if (/\bcook\s+pant/i.test(n) || /\bkitchen\s+pant/i.test(n) || /\bchef\s+pant/i.test(n)) {
    return true;
  }
  if (/\bchefwear\b/.test(n) || cat.includes("chefwear")) {
    return true;
  }
  if (/\bhospitality\b/i.test(productName) && pantsLike) {
    return true;
  }
  if ((cat.includes("chef") || cat.includes("chefwear")) && pantsLike) {
    return true;
  }
  if (isFashionBizChefLineListing(productName, meta?.slug ?? null)) {
    return true;
  }
  return false;
}

/** `/categories/[main]/[sub]` grids: socks/headwear rules; Workwear = Syzmik folder only; other workwear-only brands list under Men's/Women's/etc. */
export function isProductVisibleInCategoryBrowse(
  mainSlug: string,
  subSlug: string,
  productName: string,
  meta?: WorkwearOnlyBrandMeta,
): boolean {
  if (meta?.storefront_hidden) {
    return false;
  }
  if (isBizCorporatesCatalogProduct(productName, meta)) {
    return false;
  }
  if (isJbPpeMiscellaneousExclusiveListing(productName, meta)) {
    return mainSlug === PPE_MAIN_SLUG && subSlug === PPE_MISCELLANEOUS_SUB_SLUG;
  }

  const healthCareSub = resolveHealthCareBrowseSubSlug(productName, meta);
  if (healthCareSub != null) {
    return mainSlug === "health-care" && subSlug === healthCareSub;
  }

  if (isChefMiscellaneousExclusiveJbStyleListing(productName, meta)) {
    return mainSlug === CHEF_MAIN_SLUG && subSlug === "miscellaneous";
  }

  // Requested: Biz Collection — never Workwear browse (any sub-category).
  if (mainSlug === WORKWEAR_MAIN_SLUG && isBizCollectionListing(productName, meta?.slug ?? null, meta?.category ?? null)) {
    return false;
  }

  // Requested: JB's Wear BJ6962 — Workwear/Miscellaneous only (never other mains or Workwear subs).
  if (isWorkwearJb6962MiscExclusiveListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG && subSlug === "miscellaneous";
  }

  // Requested: 6MCP / BPU6110 / BP6474* / BPL6022 — Workwear/Pants only (never other mains or Workwear subs).
  if (isWorkwearMiscToPantsExclusiveListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG && subSlug === "pants";
  }

  // Requested: Bisley BS021M / BS10112R / BS10112S — Men's/Pants only (never Workwear or any other browse grid).
  if (isBisleyMensPantsExclusiveListing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG && subSlug === "pants";
  }

  // Requested: Bisley BBS2605L / BS022L / BS10322 / BS612SBS911L — Women's/Pants only (never Workwear or any other browse grid).
  if (isBisleyWomensPantsExclusiveListing(productName, meta)) {
    return mainSlug === WOMENS_MAIN_SLUG && subSlug === "pants";
  }

  // Requested: style `TP3160B` (Men's/Pants) — Kid's/Pants only (before women's-pants heuristics).
  if (isTp3160bKidsPantsExclusiveListing(productName, meta)) {
    return mainSlug === KIDS_MAIN_SLUG && subSlug === "pants";
  }

  // Requested: Kid-line polos under Men's/Polos — Kid's/Polos only (before JB / Hi-Vis / Workwear polo routing).
  if (isKidsLinePolosExclusiveCategoryBrowseListing(productName, meta)) {
    return mainSlug === KIDS_MAIN_SLUG && subSlug === "polos";
  }

  // Requested: J236ML / 3WSJ1 — Women's/Jackets only (often Men's/Jackets; before broad Kid's jackets heuristic).
  if (isWomensJacketsJ236ml3wsj1ExclusiveListing(productName, meta)) {
    return mainSlug === WOMENS_MAIN_SLUG && subSlug === "jackets";
  }

  // Requested: J307K / J3150B / J740K — Kid's/Jackets only (often Men's/Jackets; before Chef / broad Kid's jackets rules).
  if (isKidsJacketsJ307kJ3150bJ740kExclusiveListing(productName, meta)) {
    return mainSlug === KIDS_MAIN_SLUG && subSlug === "jackets";
  }

  // Requested: Yes Chef / Chef's / JB chef / Fashion Biz hospitality jackets — Chef/Jackets only (before Kid's jackets + JB splits).
  if (isChefLineJacketsExclusiveCategoryBrowseListing(productName, meta)) {
    return mainSlug === CHEF_MAIN_SLUG && subSlug === "jackets";
  }

  // Requested: Kid-line jackets under Men's/Jackets — Kid's/Jackets only (before JB / Workwear jacket splits).
  if (isKidsLineJacketsExclusiveCategoryBrowseListing(productName, meta)) {
    return mainSlug === KIDS_MAIN_SLUG && subSlug === "jackets";
  }

  // Requested: JB 6SPPL / 6SPPS / 6HSSP / 6HSSR — Workwear/Polos only (often Men's/Polos; before Workwear JB six-series broad allow).
  if (isJbSixSpplWorkwearPolosExclusiveListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG && subSlug === "polos";
  }

  // Requested: JB `6DARL` — Workwear/Jackets only (often Men's/Jackets; before Workwear JB six-series broad allow).
  if (isJb6darlWorkwearJacketsExclusiveListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG && subSlug === "jackets";
  }

  // Requested: Waterproof Jacket (often Workwear/Hi-vis Vest) — Workwear/Jackets only (before JB hi-vis vest gate).
  if (isWorkwearWaterproofJacketExclusiveListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG && subSlug === "jackets";
  }

  // Requested: Coverall / Overall(s) — Workwear/Coverall only (often Workwear/Pants).
  if (isWorkwearCoverallOverallExclusiveListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG && subSlug === "coverall";
  }

  // Requested: any women's / ladies' bottoms still filing under Men's/Pants — Women's/Pants only (never other mains/subs).
  if (isWomensPantLinesExclusiveToWomensPantsOnlyListing(productName, meta)) {
    return mainSlug === WOMENS_MAIN_SLUG && subSlug === "pants";
  }

  // Requested: style `S3FSZ` (Men's/Pants) — Men's/Jumper only.
  if (isMensPantsS3fszMensJumperExclusiveListing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG && subSlug === "jumper";
  }

  // Requested: style `WV619M` (Men's/Jackets) — Men's/Jumper only.
  if (isWv619mMensJumperExclusiveListing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG && subSlug === "jumper";
  }

  // Requested: JB Men's/Pants (reflective / cargo / Multi Pkt / 6DFP / …) — Workwear/Pants only.
  if (isJbMensPantsFeaturesToWorkwearPantsExclusiveListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG && subSlug === "pants";
  }

  // Requested: shirt SKUs (40S, 4P, 6ESS1, 6E, 4PUL, 4MSI, 4M, …) — Men's/Shirts only (never Women's/Workwear/other mains or subs).
  if (isFashionBizForceMensShirtsCode(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG && subSlug === "shirts";
  }

  // Requested: Biz Collection K315LS / K624LS / … / S626LL — Women's/Shirts only (never Workwear or any other browse grid).
  if (isBizCollectionWomensShirtsExclusiveListing(productName, meta)) {
    return mainSlug === WOMENS_MAIN_SLUG && subSlug === "shirts";
  }

  // Requested: LC916L / LP3506 / LP618L / LV3504 — Women's/Jumper only (never other mains or subs).
  if (isFashionBizMensJumperToWomensJumperExclusiveListing(productName, meta)) {
    return mainSlug === WOMENS_MAIN_SLUG && subSlug === "jumper";
  }

  // Requested: specific Men's/Jackets Biz jacket SKUs (+ ladies-line `…L` jacket codes) — Women's/Shirts only.
  if (isFashionBizMensJacketsToWomensShirtsExclusiveListing(productName, meta)) {
    return mainSlug === WOMENS_MAIN_SLUG && subSlug === "shirts";
  }

  // Requested: Biz Collection LB… / S10521 / S2952* + LS/LL/LT shirt SKUs — Women's/Shirts only (never Men's/Workwear/etc.).
  if (subSlug === "shirts" && isFashionBizShirtsWomensExclusiveListing(productName, meta)) {
    return mainSlug === WOMENS_MAIN_SLUG;
  }

  // Requested: Women's/Shirts rows with MS/ML Fashion Biz codes should live under Men's/Shirts.
  if (subSlug === "shirts" && isFashionBizMensMsMlListing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: women's shirt lines must not appear under Men's/Shirts (Women's/Shirts only).
  // Keep explicit Men's exceptions (forced SKUs) and MS/ML routing above.
  if (
    subSlug === "shirts" &&
    mainSlug === MENS_MAIN_SLUG &&
    !isFashionBizForceMensShirtsCode(productName, meta) &&
    !isFashionBizMensMsMlListing(productName, meta)
  ) {
    const aud = fashionBizListingGenderAudience(productName, meta?.slug ?? null, meta?.category ?? null);
    if (aud === "womens") {
      return false;
    }
    const cat = String(meta?.category ?? "").toLowerCase();
    if (/\b(women|women's|womens|ladies|lady)\b/.test(cat)) {
      return false;
    }
    if (isJbWearSupplierName(meta?.supplier_name ?? null) && isJbLadiesListing(productName, meta)) {
      return false;
    }
  }

  // Requested: specific women's pants SKUs should list under Men's/Pants only (before Bisley → Workwear-only gate).
  if (subSlug === "pants" && isWomensPantsForceMensStyleCode(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: women's pant lines must not appear under Men's/Pants (Women's/Pants only).
  // Keep explicit Men's-only SKU list (`isWomensPantsForceMensStyleCode`) above.
  if (subSlug === "pants" && mainSlug === MENS_MAIN_SLUG && !isWomensPantsForceMensStyleCode(productName, meta)) {
    const aud = fashionBizListingGenderAudience(productName, meta?.slug ?? null, meta?.category ?? null);
    if (aud === "womens") {
      return false;
    }
    const cat = String(meta?.category ?? "").toLowerCase();
    if (/\b(women|women's|womens|ladies|lady)\b/.test(cat)) {
      return false;
    }
    if (isJbWearSupplierName(meta?.supplier_name ?? null) && isJbLadiesListing(productName, meta)) {
      return false;
    }
  }

  // Requested: Hv / Hi-Vis polos should live under Workwear/Polos (not Women's/Polos).
  if (subSlug === "polos" && isHiVisHvListing(productName, meta)) {
    if (isFashionBizPolosWomensExclusiveListing(productName, meta)) {
      return mainSlug === WOMENS_MAIN_SLUG;
    }
    return mainSlug === WORKWEAR_MAIN_SLUG;
  }

  // Requested: specific SKUs belong under Women's/Jumper (not Women's or Men's → Jackets).
  if (
    (subSlug === "jackets" || subSlug === "jumper") &&
    mainSlug === MENS_MAIN_SLUG &&
    isWomensJacketsForceWomensJumperStyleCode(productName, meta)
  ) {
    return false;
  }
  if (subSlug === "jackets" && mainSlug === WOMENS_MAIN_SLUG && isWomensJacketsForceWomensJumperStyleCode(productName, meta)) {
    return false;
  }

  // Requested: JB hi-vis vests — Workwear/Hi-vis Vest only (must run before JB → Men's/Women's jackets split).
  if (isJbHiVisVestListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG && subSlug === "hi-vis-vest";
  }

  // Requested: JB Men's/Jumper-style Hi Vis / Hv / 6DAQF / 6DARF — Workwear/Jumper only (before JB jacket HV rule).
  if (isJbHiVisOr6daqf6darfWorkwearJumperExclusiveListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG && subSlug === "jumper";
  }

  // Requested: JB Men's/Jackets-style Hi Vis / Hv / 6DVRL outerwear — Workwear/Jackets only.
  if (isJbHiVisOr6dvrlWorkwearJacketsExclusiveListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG && subSlug === "jackets";
  }

  // Requested: JB jackets shown under Women's should be Women's-only when explicitly Ladies/Women's.
  // Otherwise route them to Men's/Jackets.
  if (subSlug === "jackets" && isJbWearSupplierName(meta?.supplier_name ?? null)) {
    const ladies = isJbLadiesListing(productName, meta);
    if (ladies) {
      return mainSlug === WOMENS_MAIN_SLUG;
    }
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: specific women's polos SKUs should list under Men's/Polos.
  if (subSlug === "polos" && isFashionBizForceMensPolosCode(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: Women's/Polos should not show JB polos unless explicitly Ladies/Women's.
  // Non-Ladies JB polos should list under Men's/Polos.
  if (subSlug === "polos" && isJbWearSupplierName(meta?.supplier_name ?? null)) {
    const isLadies = isJbLadiesListing(productName, meta);
    if (isLadies) {
      return mainSlug === WOMENS_MAIN_SLUG;
    }
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: Women's/Polos rows with MS/ML Fashion Biz codes should live under Men's/Polos.
  if (subSlug === "polos" && isFashionBizMensMsMlListing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: women's polo lines must not appear under Men's/Polos (Women's/Polos only).
  // Keep explicit Men's exceptions (forced SKUs) and MS/ML routing above.
  if (
    subSlug === "polos" &&
    mainSlug === MENS_MAIN_SLUG &&
    !isFashionBizForceMensPolosCode(productName, meta) &&
    !isFashionBizMensMsMlListing(productName, meta)
  ) {
    const aud = fashionBizListingGenderAudience(productName, meta?.slug ?? null, meta?.category ?? null);
    if (aud === "womens") {
      return false;
    }
    const cat = String(meta?.category ?? "").toLowerCase();
    if (/\b(women|women's|womens|ladies|lady)\b/.test(cat)) {
      return false;
    }
    if (isJbWearSupplierName(meta?.supplier_name ?? null) && isJbLadiesListing(productName, meta)) {
      return false;
    }
  }

  // Requested: Biz Collection men's jackets should not appear under Women's/Jackets.
  if (subSlug === "jackets" && isBizCollectionMensJacketListing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: specific women's jackets SKUs should list under Men's/Jackets.
  if (subSlug === "jackets" && isFashionBizForceMensJacketsCode(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: Women's/Jackets rows with M/MN Fashion Biz codes should live under Men's/Jackets.
  if (subSlug === "jackets" && isFashionBizMensMOrMnListing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: women's jacket lines must not appear under Men's/Jackets (Women's/Jackets only).
  // Keep explicit Men's exceptions (forced SKUs) and M/MN routing above.
  if (
    subSlug === "jackets" &&
    mainSlug === MENS_MAIN_SLUG &&
    !isFashionBizForceMensJacketsCode(productName, meta) &&
    !isFashionBizMensMOrMnListing(productName, meta)
  ) {
    const aud = fashionBizListingGenderAudience(productName, meta?.slug ?? null, meta?.category ?? null);
    if (aud === "womens") {
      return false;
    }
    const cat = String(meta?.category ?? "").toLowerCase();
    if (/\b(women|women's|womens|ladies|lady)\b/.test(cat)) {
      return false;
    }
    if (isJbWearSupplierName(meta?.supplier_name ?? null) && isJbLadiesListing(productName, meta)) {
      return false;
    }
  }

  // Requested: Hi-Vis ("Hv") tees should live under Workwear/T-shirts (not Men's/T-shirts).
  if (subSlug === "t-shirts" && isHiVisHvListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG;
  }

  // Requested: Women's/T-shirts rows with MS/ML Fashion Biz codes — Men's/T-shirts only (mirror Polos/Shirts).
  if (subSlug === "t-shirts" && isFashionBizMensMsMlListing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: Women's/T-shirts rows with M/MN men's line codes — Men's/T-shirts only (mirror Jackets).
  if (subSlug === "t-shirts" && isFashionBizMensMOrMnListing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG;
  }

  // Requested: no men's-leaning tees under Women's/T-shirts (titles/categories + Biz audience when DB audience is empty).
  if (mainSlug === WOMENS_MAIN_SLUG && subSlug === "t-shirts") {
    if (isWomensTshirtsExcludedSkuListing(productName, meta)) {
      return false;
    }
    if (isMensLeanTeeTextOrAudienceForWomensTshirtsBrowse(productName, meta)) {
      return false;
    }
  }

  if (mainSlug === WOMENS_MAIN_SLUG && subSlug === "jumper" && isWomensJumperExcludedSkuListing(productName, meta)) {
    return false;
  }

  // Requested: JB hi-vis polos should live under Workwear/Polos (not Men's/Polos).
  if (subSlug === "polos" && isJbHiVisListing(productName, meta)) {
    return mainSlug === WORKWEAR_MAIN_SLUG;
  }

  // Requested: "Street" polos should live under Workwear/Polos (not Men's/Polos).
  if (subSlug === "polos" && isStreetPolosListing(productName, meta)) {
    if (isFashionBizPolosWomensExclusiveListing(productName, meta)) {
      return mainSlug === WOMENS_MAIN_SLUG;
    }
    return mainSlug === WORKWEAR_MAIN_SLUG;
  }

  // Requested: Biz Collection LS/LL polo SKUs + listed P codes — Women's/Polos only (after HV/Street carve-outs above).
  if (subSlug === "polos" && isFashionBizPolosWomensExclusiveListing(productName, meta)) {
    return mainSlug === WOMENS_MAIN_SLUG;
  }

  // Requested: Hv / Work Shirt / Reflective shirts should live under Workwear/Shirts (not Men's/Shirts).
  if (subSlug === "shirts" && isWorkwearShirtsKeywordListing(productName, meta)) {
    if (isFashionBizShirtsWomensExclusiveListing(productName, meta)) {
      return mainSlug === WOMENS_MAIN_SLUG;
    }
    return mainSlug === WORKWEAR_MAIN_SLUG;
  }

  // Requested: rail / Hv / Hi Vis / Road jackets should live under Workwear/Jackets (not Men's/Jackets).
  if (subSlug === "jackets" && isWorkwearJacketsKeywordListing(productName, meta)) {
    if (isJbHiVisOr6daqf6darfWorkwearJumperExclusiveListing(productName, meta)) {
      return false;
    }
    return mainSlug === WORKWEAR_MAIN_SLUG;
  }

  // Special case requested: Bisley BB101 should live under PPE → Miscellaneous, not under Workwear.
  if (isBisleyBb101Listing(productName, meta)) {
    return mainSlug === PPE_MAIN_SLUG && subSlug === PPE_MISCELLANEOUS_SUB_SLUG;
  }

  // Special case requested: Bisley BS6404 should live under Men's → Polos (not under Workwear).
  if (isBisleyBs6404Listing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG && subSlug === "polos";
  }

  // Special case requested: women's cardigans currently under Workwear/Jackets should list under Women's/Jackets.
  if (isWomensCardiganListing(productName, meta)) {
    return mainSlug === WOMENS_MAIN_SLUG && subSlug === "jackets";
  }

  // Special case requested: these JB knitted vests should list under Men's → Jumper.
  if (isJbKnitVestMensJumperListing(productName, meta)) {
    return mainSlug === MENS_MAIN_SLUG && subSlug === "jumper";
  }

  // Workwear is the home for Syzmik + Bisley; do not apply PPE-only exclusions to these brands here.
  if (mainSlug === WORKWEAR_MAIN_SLUG) {
    if (isSyzmikCatalogProduct(productName, meta) || isBisleyCatalogProduct(productName, meta)) {
      if (isBisleyWomensPantsExclusiveListing(productName, meta)) {
        return false;
      }
      if (isWomensPantLinesExclusiveToWomensPantsOnlyListing(productName, meta)) {
        return false;
      }
      return true;
    }
  }

  if (isYesChefCatalogProduct(productName, meta) && mainSlug !== CHEF_MAIN_SLUG) {
    return false;
  }

  if (mainSlug === CHEF_MAIN_SLUG && subSlug === "jackets") {
    return isChefLineJacketsExclusiveCategoryBrowseListing(productName, meta);
  }

  if (mainSlug === CHEF_MAIN_SLUG && subSlug === "pants") {
    return isChefCategoryPantsListing(productName, meta);
  }

  if (mainSlug === CHEF_MAIN_SLUG && subSlug === "miscellaneous" && productName.toLowerCase().includes("vest")) {
    return false;
  }

  const aud = normalizeAudience(meta?.audience ?? null);
  if (aud) {
    if (mainSlug === KIDS_MAIN_SLUG) {
      return aud === "kids";
    }
    if (mainSlug === MENS_MAIN_SLUG) {
      return aud === "mens" || aud === "unisex";
    }
    if (mainSlug === WOMENS_MAIN_SLUG) {
      return aud === "womens" || aud === "unisex";
    }
  }

  // JB's Wear: keyword-based audience gating so Ladies items don't leak into Men's.
  // (Not all environments have `products.audience` populated, so keep a safe fallback here.)
  const supplierName = String(meta?.supplier_name ?? "").trim().toLowerCase();
  if (supplierName === "jb's wear" || supplierName === "jbs wear" || supplierName === "jbswear") {
    const n = productName.toLowerCase();
    const jbForceMensJackets =
      /\b(hoodie|polar|fleecy)\b/i.test(productName) ||
      n.includes(" hoodie") ||
      n.includes(" polar") ||
      n.includes(" fleecy");
    const isWomen =
      /\b(ladies|lady|women|women's|womens)\b/i.test(productName) || n.includes("ladies ");
    const isMen = /\b(mens|men|men's)\b/i.test(productName);
    const isKids = /\b(kids|kid's|children|child)\b/i.test(productName);

    // Explicit rule requested: JB hoodie/polar/fleecy → Men's / Jackets.
    if (jbForceMensJackets) {
      if (mainSlug !== MENS_MAIN_SLUG) {
        return false;
      }
      return subSlug === "jackets";
    }

    if (mainSlug === KIDS_MAIN_SLUG) {
      return isKids;
    }
    if (mainSlug === MENS_MAIN_SLUG) {
      if (isWomen) {
        return false;
      }
      if (isKids) {
        return false;
      }
      // Men's or unisex.
      return true;
    }
    if (mainSlug === WOMENS_MAIN_SLUG) {
      if (isMen) {
        return false;
      }
      if (isKids) {
        return false;
      }
      // Women's or unisex.
      return true;
    }
  }

  /** Kid-only tee T10032: only `/categories/kids/t-shirts` (see `isKidsOnlyTshirtT10032Product`). */
  if (isKidsOnlyTshirtT10032Product(productName, meta)) {
    return mainSlug === KIDS_MAIN_SLUG && subSlug === "t-shirts";
  }
  if (isSocksKeywordProduct(productName, meta)) {
    return mainSlug === PPE_MAIN_SLUG && subSlug === PPE_MISCELLANEOUS_SUB_SLUG;
  }
  if (isBagKeywordProduct(productName, meta)) {
    return mainSlug === PPE_MAIN_SLUG && subSlug === PPE_MISCELLANEOUS_SUB_SLUG;
  }
  if (isBizCareListingInMiscGeneratedSet(productName, meta?.slug ?? null)) {
    return mainSlug === PPE_MAIN_SLUG && subSlug === PPE_MISCELLANEOUS_SUB_SLUG;
  }
  if (isBizCareSocksBagOrHatMisc(productName, meta)) {
    return mainSlug === PPE_MAIN_SLUG && subSlug === PPE_MISCELLANEOUS_SUB_SLUG;
  }
  if (isHeadWearKeywordProduct(productName) && !isJbWearSixSeriesListing(productName, meta)) {
    return mainSlug === PPE_MAIN_SLUG && subSlug === PPE_HEAD_WEAR_SUB_SLUG;
  }
  if (isSyzmikZaPpeMiscListing(productName, meta)) {
    return mainSlug === PPE_MAIN_SLUG && subSlug === PPE_MISCELLANEOUS_SUB_SLUG;
  }

  // Syzmik + Bisley should only appear under Workwear.
  if (mainSlug !== WORKWEAR_MAIN_SLUG) {
    if (isSyzmikCatalogProduct(productName, meta) || isBisleyCatalogProduct(productName, meta)) {
      return false;
    }
  }

  if (mainSlug === WORKWEAR_MAIN_SLUG) {
    if (isSyzmikCatalogProduct(productName, meta) || isBisleyCatalogProduct(productName, meta)) {
      if (isBisleyWomensPantsExclusiveListing(productName, meta)) {
        return false;
      }
      if (isWomensPantLinesExclusiveToWomensPantsOnlyListing(productName, meta)) {
        return false;
      }
      return true;
    }
    if (subSlug === "shirts" && isWorkwearShirtsKeywordListing(productName, meta)) {
      if (isFashionBizShirtsWomensExclusiveListing(productName, meta)) {
        return false;
      }
      return true;
    }
    if (subSlug === "jumper" && isJbHiVisOr6daqf6darfWorkwearJumperExclusiveListing(productName, meta)) {
      return true;
    }
    if (
      subSlug === "jackets" &&
      (isWorkwearJacketsKeywordListing(productName, meta) ||
        isJbHiVisOr6dvrlWorkwearJacketsExclusiveListing(productName, meta))
    ) {
      if (isJbHiVisOr6daqf6darfWorkwearJumperExclusiveListing(productName, meta)) {
        return false;
      }
      return true;
    }
    if (isJbWearSixSeriesListing(productName, meta)) {
      if (isJbWorkwearExcludedHeadwearOrSocks(productName, meta)) {
        return false;
      }
      return true;
    }
    return false;
  }
  // Other workwear-only brands (if any) should remain hidden outside Workwear.
  if (isWorkwearOnlyBrandProduct(productName, meta)) {
    return false;
  }
  if (isBizCollectionKidsExclusiveListing(productName, meta?.slug ?? null)) {
    return mainSlug === KIDS_MAIN_SLUG;
  }
  /**
   * Kid's browse: allow only rows classified as kid lines (T10032 / Biz kid SKUs handled above).
   * Previously we only hid `mens` / `womens`; `null` (non–Biz Care/Collection) and `unisex` still passed,
   * so adult catalog rows could appear under Kid's whenever the sub-slug matched.
   */
  if (mainSlug === KIDS_MAIN_SLUG) {
    const audience = fashionBizListingGenderAudience(productName, meta?.slug ?? null, meta?.category ?? null);
    if (audience !== "kids") {
      return false;
    }
  }
  if (mainSlug === MENS_MAIN_SLUG || mainSlug === WOMENS_MAIN_SLUG) {
    const audience = fashionBizListingGenderAudience(productName, meta?.slug ?? null, meta?.category ?? null);
    if (audience === "mens" && mainSlug !== MENS_MAIN_SLUG) {
      return false;
    }
    if (audience === "womens" && mainSlug !== WOMENS_MAIN_SLUG) {
      return false;
    }
    if (audience === "kids") {
      return false;
    }
  }
  return true;
}

/** Homepage / showcase: Syzmik (Workwear-only) and socks/headwear specials only via their category menus. */
export function isProductVisibleOnHomeStorefront(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (meta?.storefront_hidden) {
    return false;
  }
  if (isBizCorporatesCatalogProduct(productName, meta)) {
    return false;
  }
  if (isSocksKeywordProduct(productName, meta)) {
    return false;
  }
  if (isBagKeywordProduct(productName, meta)) {
    return false;
  }
  if (isBizCareListingInMiscGeneratedSet(productName, meta?.slug ?? null)) {
    return false;
  }
  if (isBizCareSocksBagOrHatMisc(productName, meta)) {
    return false;
  }
  if (isHeadWearKeywordProduct(productName)) {
    return false;
  }
  return !isSyzmikCatalogProduct(productName, meta);
}

/**
 * Supabase rows eligible for site search / typeahead (includes Syzmik, socks, etc.).
 * Homepage category tiles still use `isProductVisibleOnHomeStorefront`.
 */
export function isProductEligibleForSiteSearch(productName: string, meta?: WorkwearOnlyBrandMeta): boolean {
  if (meta?.storefront_hidden) {
    return false;
  }
  return !isBizCorporatesCatalogProduct(productName, meta);
}

/**
 * Product card grids (category browse, home search): require a non-empty `name` and parseable `base_price`.
 * Rows reappear automatically after the next load/realtime fetch once the DB is updated.
 */
export function hasStorefrontListNameAndPrice(name: unknown, basePrice: unknown): boolean {
  if (typeof name !== "string" || name.trim().length === 0) {
    return false;
  }
  return parseBasePrice(basePrice) !== null;
}

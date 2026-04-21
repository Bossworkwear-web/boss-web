import { parseBasePrice } from "@/lib/product-price";
import { isBizCareListingInMiscGeneratedSet } from "@/lib/biz-care-misc-route";
import bizCollectionKidsOnlyJacketsCodes from "@/lib/biz-collection-kids-only-jackets.json";
import bizCollectionKidsOnlyPantsCodes from "@/lib/biz-collection-kids-only-pants.json";
import bizCollectionKidsOnlyTShirtsCodes from "@/lib/biz-collection-kids-only-t-shirts.json";
import {
  fashionBizListingGenderAudience,
  fashionBizListingKidsOnlyTshirtMatched,
  listingCodeMatchesKidsOnlyTshirt,
} from "@/lib/fashion-biz-gender-route";
import { FASHION_BIZ_LISTING_SUBSLUG } from "@/lib/fashion-biz-listing-subslug.generated";
import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";

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
  const blob = workwearOnlyBrandSearchText(productName, meta);

  if (blob.includes("yes chef")) {
    return true;
  }
  if (/\bchef\b/i.test(productName)) {
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

  // Workwear is the home for Syzmik + Bisley; do not apply PPE-only exclusions to these brands here.
  if (mainSlug === WORKWEAR_MAIN_SLUG) {
    if (isSyzmikCatalogProduct(productName, meta) || isBisleyCatalogProduct(productName, meta)) {
      return true;
    }
  }

  if (isYesChefCatalogProduct(productName, meta) && mainSlug !== CHEF_MAIN_SLUG) {
    return false;
  }

  if (mainSlug === CHEF_MAIN_SLUG && subSlug === "jackets") {
    return isChefCategoryJacketListing(productName, meta);
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

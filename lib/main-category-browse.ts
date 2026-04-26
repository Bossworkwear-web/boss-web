import { getSubCategoriesForMain, HEALTH_CARE_MAIN_SLUG } from "@/lib/catalog";
import { getDiscountPercent } from "@/lib/discounts";
import {
  hasStorefrontListNameAndPrice,
  isBizCollectionWomensShirtsExclusiveListing,
  isFashionBizMensJacketsToWomensShirtsExclusiveListing,
  isFashionBizMensJumperToWomensJumperExclusiveListing,
  isFashionBizPolosWomensExclusiveListing,
  isFashionBizShirtsWomensExclusiveListing,
  isBisleyMensPantsExclusiveListing,
  isBisleyWomensPantsExclusiveListing,
  isWomensPantLinesExclusiveToWomensPantsOnlyListing,
  isMensPantsS3fszMensJumperExclusiveListing,
  isWv619mMensJumperExclusiveListing,
  isTp3160bKidsPantsExclusiveListing,
  isKidsLinePolosExclusiveCategoryBrowseListing,
  isKidsLineJacketsExclusiveCategoryBrowseListing,
  isKidsJacketsJ307kJ3150bJ740kExclusiveListing,
  isWomensJacketsJ236ml3wsj1ExclusiveListing,
  isChefLineJacketsExclusiveCategoryBrowseListing,
  isChefMiscellaneousExclusiveJbStyleListing,
  isJbHiVisOr6daqf6darfWorkwearJumperExclusiveListing,
  isJbHiVisOr6dvrlWorkwearJacketsExclusiveListing,
  isJbMensPantsFeaturesToWorkwearPantsExclusiveListing,
  isWorkwearJb6962MiscExclusiveListing,
  isJbSixSpplWorkwearPolosExclusiveListing,
  isJb6darlWorkwearJacketsExclusiveListing,
  isWorkwearWaterproofJacketExclusiveListing,
  isWorkwearCoverallOverallExclusiveListing,
  isWorkwearMiscToPantsExclusiveListing,
  isFashionBizChefLineListing,
  isJbPpeMiscellaneousExclusiveListing,
  isProductEligibleForSiteSearch,
  isProductVisibleInCategoryBrowse,
  isWomensJacketsForceWomensJumperStyleCode,
  isYesChefCatalogProduct,
} from "@/lib/product-visibility";
import { storefrontStripSupplierBranding } from "@/lib/product-display-name";
import {
  inferSubSlugFromNameHeuristics,
  resolveProductSubSlug,
  subSlugFromDbCategory,
} from "@/lib/product-subslug";
import {
  isHealthCareCatalogListing,
  resolveHealthCareBrowseSubSlug,
} from "@/lib/health-care-browse";
import { SYZMIK_STYLE_MARKETING_TITLE } from "@/lib/syzmik-style-titles.generated";

export type CategoryBrowseProductRow = {
  id: string;
  name: string;
  base_price: number | null;
  sale_price?: number | null;
  image_urls?: string[] | null;
  category?: string | null;
  slug?: string | null;
  description?: string | null;
  storefront_hidden?: boolean | null;
  audience?: string | null;
  supplier_name?: string | null;
  available_colors?: string[] | null;
  available_sizes?: string[] | null;
};

/** Category and subcategory product grids — how many cards per page before ?page=2, … */
export const CATEGORY_BROWSE_PAGE_SIZE = 15;

const CHEF_STOREFRONT_SUB_SLUGS = new Set(["jackets", "pants", "apron", "miscellaneous"]);

function rowTextIncludesApron(item: CategoryBrowseProductRow): boolean {
  const blob = [item.name, item.category, item.description, item.slug]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join("\n")
    .toLowerCase();
  return blob.includes("apron");
}

/** Apron-style listings often say “Bib” / “Pinny” without the word “Apron” in the supplier title. */
function rowLooksLikeApronGarment(item: CategoryBrowseProductRow): boolean {
  if (rowTextIncludesApron(item)) {
    return true;
  }
  const blob = [item.name, item.category, item.description]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join("\n")
    .toLowerCase();
  if (/\bpinny\b/.test(blob)) {
    return true;
  }
  if (blob.includes("bib") && !/\bbible\b/i.test(blob)) {
    return true;
  }
  return false;
}

/** Map DB/listing `chef` sub-slug into real Chef menu subs (jackets / pants / apron / miscellaneous). */
export function resolveChefCategoryBrowseSubSlug(item: CategoryBrowseProductRow): string | null {
  const browseMeta = {
    slug: item.slug ?? null,
    category: item.category ?? null,
    description: item.description ?? null,
    supplier_name: item.supplier_name ?? null,
    audience: item.audience ?? null,
    storefront_hidden: item.storefront_hidden ?? null,
  };
  if (isChefMiscellaneousExclusiveJbStyleListing(item.name, browseMeta)) {
    return "miscellaneous";
  }
  if (isChefLineJacketsExclusiveCategoryBrowseListing(item.name, browseMeta)) {
    return "jackets";
  }

  const blendedForChef = [item.name, item.category, item.description]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ");

  // Chef rule: Apron in title, or only in description / category text (e.g. style code in name, details below).
  const h0 = inferSubSlugFromNameHeuristics(item.name);
  if (h0 === "apron") {
    return "apron";
  }
  if (inferSubSlugFromNameHeuristics(blendedForChef) === "apron") {
    return "apron";
  }

  const yesChefMeta = {
    slug: item.slug ?? null,
    category: item.category ?? null,
    description: item.description ?? null,
    supplier_name: item.supplier_name ?? null,
  };
  // Yes Chef + Fashion Biz hospitality (`chef` SKU bucket): apron-style rows → Chef/Apron
  // (Biz Collection BA… titles often omit “Yes Chef”; bib/pinny titles may omit “apron”).
  const isChefHospitalityLine =
    isYesChefCatalogProduct(item.name, yesChefMeta) || isFashionBizChefLineListing(item.name, item.slug);
  if (isChefHospitalityLine && rowLooksLikeApronGarment(item)) {
    return "apron";
  }

  // Yes Chef rows often have DB `category` = "Chef" (sync rule) even for trousers; name may be SKU-only.
  // Use blended text so description / sumTitle can surface "pant" / "trouser" before falling through to misc.
  const blendedLower = blendedForChef.toLowerCase();
  const chefBlendedLooksLikePants =
    /\b(pant|pants|trouser|trousers|jogger|joggers|overall)\b/.test(blendedLower) ||
    (/\bshorts\b/i.test(blendedLower) && !rowLooksLikeApronGarment(item));
  if (chefBlendedLooksLikePants) {
    return "pants";
  }

  const r =
    resolveProductSubSlug(item.name, item.category, item.slug, item.description) ??
    subSlugFromDbCategory(item.category) ??
    inferSubSlugFromNameHeuristics(item.name);
  if (r === "chef") {
    const h = inferSubSlugFromNameHeuristics(item.name);
    if (CHEF_STOREFRONT_SUB_SLUGS.has(h) && h !== "chef") {
      return h;
    }
    const hb = inferSubSlugFromNameHeuristics(blendedForChef);
    if (CHEF_STOREFRONT_SUB_SLUGS.has(hb) && hb !== "chef") {
      return hb;
    }
    if (isChefHospitalityLine && rowLooksLikeApronGarment(item)) {
      return "apron";
    }
    return "miscellaneous";
  }

  // `resolveProductSubSlug` often returns `miscellaneous` (Biz Care misc set, socks, vest heuristics, …)
  // while Chef browse still needs hospitality aprons under Chef/Apron.
  const wantsChefApron =
    inferSubSlugFromNameHeuristics(item.name) === "apron" ||
    inferSubSlugFromNameHeuristics(blendedForChef) === "apron" ||
    (typeof item.description === "string" &&
      item.description.trim().length > 0 &&
      inferSubSlugFromNameHeuristics(item.description) === "apron") ||
    rowLooksLikeApronGarment(item);

  if ((r === "miscellaneous" || r === "chef") && isChefHospitalityLine && wantsChefApron) {
    return "apron";
  }

  return r;
}

const SUB_SLUGS_FOR_MAIN_CACHE = new Map<string, ReadonlySet<string>>();

function allowedSubSlugsForMain(mainSlug: string): ReadonlySet<string> {
  const cached = SUB_SLUGS_FOR_MAIN_CACHE.get(mainSlug);
  if (cached) {
    return cached;
  }
  const set = new Set(getSubCategoriesForMain(mainSlug).map((s) => s.slug));
  SUB_SLUGS_FOR_MAIN_CACHE.set(mainSlug, set);
  return set;
}

function workwearCategoryBrowseTextBlob(item: CategoryBrowseProductRow): string {
  return [item.name, item.category, item.description, item.slug]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

/** Tee / singlet / tank-style tops (used for Syzmik Polos → T-shirts and Work Shirts ordering). */
function looksLikeSyzmikTeeGarmentInBlob(blob: string): boolean {
  return /\b(tee|t-shirt|t shirt|singlet|tank top|\btank\b|crew neck|v-neck|v neck|scoop neck|raglan|cotton tee|sleeveless tee)\b/i.test(
    blob,
  );
}

function looksLikeSyzmikTeeGarmentRow(item: CategoryBrowseProductRow): boolean {
  return looksLikeSyzmikTeeGarmentInBlob(workwearCategoryBrowseTextBlob(item));
}

function syzmikStyleCodesForBrowseRow(item: CategoryBrowseProductRow): { code: string; base: string } | null {
  const stripped = storefrontStripSupplierBranding(item.name).trim();
  const head = stripped.split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z0-9-]/g, "") ?? "";
  let code: string | null = null;
  if (/^Z[A-Z0-9]{2,}$/i.test(head)) {
    code = head;
  } else {
    const m = `${item.name} ${item.slug ?? ""}`.toUpperCase().match(/\b(ZH[L]?\d{3})\b/);
    if (m) {
      code = m[1];
    }
  }
  if (!code) {
    return null;
  }
  const upper = code.toUpperCase();
  return { code: upper, base: upper.replace(/-CLEARANCE$/i, "") };
}

function syzmikCsvMarketingTitleForBrowseRow(item: CategoryBrowseProductRow): string | null {
  const keys = syzmikStyleCodesForBrowseRow(item);
  if (!keys) {
    return null;
  }
  const raw = SYZMIK_STYLE_MARKETING_TITLE[keys.code] ?? SYZMIK_STYLE_MARKETING_TITLE[keys.base];
  return raw?.trim() ? raw.trim() : null;
}

function syzmikCsvTitleImpliesTee(title: string): boolean {
  return looksLikeSyzmikTeeGarmentInBlob(title.toLowerCase());
}

/** Jackets → Jumper when knit-layer keywords present and not clearly outerwear jacket. */
function looksLikeWorkwearJacketsToJumperRow(item: CategoryBrowseProductRow): boolean {
  const blob = workwearCategoryBrowseTextBlob(item);
  const wantsJumper = /\b(fleece|hoodie|hoody|pullover|sweatshirt|jumper)\b/.test(blob);
  if (!wantsJumper) {
    return false;
  }
  const looksLikeJacket =
    /\b(jacket|coat|parka|windbreaker|bomber|anorak|softshell|hard\s*shell|hardshell|rain)\b/.test(blob);
  return !looksLikeJacket;
}

/**
 * T-shirts → Jumper when title/category text clearly names fleece / hoodie / pullover / jumper / sweatshirt
 * (fixes Workwear rows mis-bucketed under T-shirts).
 */
function looksLikeWorkwearTshirtsToJumperRow(item: CategoryBrowseProductRow): boolean {
  const blob = workwearCategoryBrowseTextBlob(item);
  return /\b(fleece|hoodie|hoody|pullover|jumper|sweatshirt)\b/.test(blob);
}

/** Men's jackets grid often catches hoodies/sweaters; route those to Men's/Jumper. */
function looksLikeMensJacketsToJumperRow(item: CategoryBrowseProductRow): boolean {
  const blob = workwearCategoryBrowseTextBlob(item);
  const wantsJumper = /\b(hoodie|hoody|sweatshirt|jumper|sweater|pullover|fleece|knit(?:ted)?)\b/i.test(blob);
  if (!wantsJumper) {
    return false;
  }
  const looksLikeOuterwear =
    /\b(jacket|coat|parka|windbreaker|bomber|anorak|softshell|hard\s*shell|hardshell|rain|puffer)\b/i.test(blob);
  return !looksLikeOuterwear;
}

/** Syzmik style codes that must list under Workwear/Jumper even when DB/subslug says T-shirts. */
const WORKWEAR_SYZMIK_STYLE_FORCE_JUMPER = new Set(["ZT475"]);

/** Syzmik style codes that must list under Workwear/T-shirts (e.g. tee miscategorized as Polos). */
const WORKWEAR_SYZMIK_STYLE_FORCE_T_SHIRTS = new Set(["ZH735"]);

function isWorkwearBrowseRowSyzmik(item: CategoryBrowseProductRow): boolean {
  const sn = String(item.supplier_name ?? "").trim().toLowerCase();
  if (sn.includes("syzmik")) {
    return true;
  }
  const hay = `${item.name} ${item.slug ?? ""} ${item.description ?? ""}`.toLowerCase();
  return hay.includes("syzmik");
}

function workwearSyzmikStyleForcedJumper(item: CategoryBrowseProductRow): boolean {
  if (!isWorkwearBrowseRowSyzmik(item)) {
    return false;
  }
  const hay = `${item.name}\n${item.slug ?? ""}\n${item.description ?? ""}`.toUpperCase();
  for (const code of WORKWEAR_SYZMIK_STYLE_FORCE_JUMPER) {
    if (hay.includes(code)) {
      return true;
    }
  }
  return false;
}

function workwearSyzmikStyleForcedTshirts(item: CategoryBrowseProductRow): boolean {
  if (!isWorkwearBrowseRowSyzmik(item)) {
    return false;
  }
  const hay = `${item.name}\n${item.slug ?? ""}\n${item.description ?? ""}`.toUpperCase();
  for (const code of WORKWEAR_SYZMIK_STYLE_FORCE_T_SHIRTS) {
    if (hay.includes(code)) {
      return true;
    }
  }
  return false;
}

/**
 * Syzmik sync maps the "Shirts + Polos" supplier folder to DB `Work Shirts` → subslug `work-shirts`.
 * Those rows never matched Workwear/T-shirts (`workwearResolved === "t-shirts"`). Send tees/casual
 * tops to T-shirts (and polo-like titles to Polos) while keeping woven / dress-style shirts on Shirts.
 */
function looksLikeSyzmikWorkShirtsFormalOrWovenShirt(item: CategoryBrowseProductRow): boolean {
  const blob = workwearCategoryBrowseTextBlob(item);
  if (/\b(polo|pique)\b/i.test(blob)) {
    return false;
  }
  if (looksLikeSyzmikTeeGarmentInBlob(blob)) {
    return false;
  }
  return (
    /\b(utility shirt|dress shirt|business shirt|oxford shirt|denim shirt|chambray shirt|flannel shirt)\b/i.test(
      blob,
    ) ||
    /\bwork shirt\b/i.test(blob) ||
    (/\bshirt\b/i.test(blob) && /\bbutton\b/i.test(blob))
  );
}

/**
 * Bottoms mis-filed under Workwear / Shirts (DB `Shirts` or `Work Shirts`). Uses name/category/description/slug
 * only — avoids bare "short" so "short sleeve shirt" rows are not treated as shorts.
 */
function looksLikeWorkwearBottomGarmentRow(item: CategoryBrowseProductRow): boolean {
  const blob = workwearCategoryBrowseTextBlob(item);
  return (
    /\bjeans?\b/i.test(blob) ||
    /\bjeggings?\b/i.test(blob) ||
    /\b(trousers?|pants?|joggers?|overalls?)\b/i.test(blob) ||
    /\bshorts\b/i.test(blob) ||
    /\b(cargo|work|board|chino|rugby|stretch|summer|walk|golf|bermuda|utility|drill|denim)\s+short\b/i.test(blob)
  );
}

function looksLikeWorkwearTankOrSingletRow(item: CategoryBrowseProductRow): boolean {
  const blob = workwearCategoryBrowseTextBlob(item);
  return /\b(singlet|tank top|\btank\b)\b/i.test(blob);
}

function looksLikeWorkwearWovenShirtRow(item: CategoryBrowseProductRow): boolean {
  const blob = workwearCategoryBrowseTextBlob(item);
  // Don't steal tees/polos from their correct buckets.
  if (looksLikeSyzmikTeeGarmentInBlob(blob) || /\b(polo|pique)\b/i.test(blob)) {
    return false;
  }
  // Common woven/work shirt signals.
  return (
    /\b(work shirt|work-shirt|utility shirt|overshirt|flannel shirt|oxford shirt|dress shirt|business shirt)\b/i.test(
      blob,
    ) ||
    (/\bshirt\b/i.test(blob) && /\b(button|buttons|button-up|button up)\b/i.test(blob))
  );
}

function resolveWorkwearCategoryBrowseSubSlug(
  resolved: string | null,
  item: CategoryBrowseProductRow,
): string | null {
  const workwearRowMeta = {
    slug: item.slug ?? null,
    category: item.category ?? null,
    description: item.description ?? null,
    supplier_name: item.supplier_name ?? null,
    audience: item.audience ?? null,
    storefront_hidden: item.storefront_hidden ?? null,
  };
  if (isJbSixSpplWorkwearPolosExclusiveListing(item.name, workwearRowMeta)) {
    return "polos";
  }
  if (isJb6darlWorkwearJacketsExclusiveListing(item.name, workwearRowMeta)) {
    return "jackets";
  }
  if (isWorkwearWaterproofJacketExclusiveListing(item.name, workwearRowMeta)) {
    return "jackets";
  }
  if (isWorkwearCoverallOverallExclusiveListing(item.name, workwearRowMeta)) {
    return "coverall";
  }
  if (resolved == null || resolved === "") {
    return null;
  }
  if (isWorkwearJb6962MiscExclusiveListing(item.name, workwearRowMeta)) {
    return "miscellaneous";
  }
  if (isJbHiVisOr6daqf6darfWorkwearJumperExclusiveListing(item.name, workwearRowMeta)) {
    return "jumper";
  }
  if (isJbHiVisOr6dvrlWorkwearJacketsExclusiveListing(item.name, workwearRowMeta)) {
    return "jackets";
  }
  if (isWorkwearMiscToPantsExclusiveListing(item.name, workwearRowMeta)) {
    return "pants";
  }
  if (isJbMensPantsFeaturesToWorkwearPantsExclusiveListing(item.name, workwearRowMeta)) {
    return "pants";
  }
  if (workwearSyzmikStyleForcedJumper(item)) {
    return "jumper";
  }
  if (workwearSyzmikStyleForcedTshirts(item)) {
    return "t-shirts";
  }
  // Workwear/Miscellaneous sometimes contains vest items (from supplier buckets / misc codes).
  // Always list vests under Workwear/Hi-vis Vest instead.
  if (resolved === "miscellaneous") {
    const blob = workwearCategoryBrowseTextBlob(item);
    if (/\bvests?\b/i.test(blob)) {
      return "hi-vis-vest";
    }
  }
  // Workwear/Shirts often receives singlets/tanks via supplier folders; always show under Workwear/T-shirts.
  if (
    (resolved === "shirts" || resolved === "work-shirts") &&
    looksLikeWorkwearTankOrSingletRow(item)
  ) {
    return "t-shirts";
  }
  // Workwear/Pants sometimes receives woven shirts via supplier folders; always list under Workwear/Shirts.
  if (resolved === "pants" && looksLikeWorkwearWovenShirtRow(item)) {
    return "shirts";
  }
  if (
    (resolved === "shirts" || resolved === "work-shirts") &&
    looksLikeWorkwearBottomGarmentRow(item)
  ) {
    return "pants";
  }
  if (isWorkwearBrowseRowSyzmik(item) && resolved === "work-shirts") {
    const csvTitle = syzmikCsvMarketingTitleForBrowseRow(item);
    if (
      (csvTitle != null && syzmikCsvTitleImpliesTee(csvTitle)) ||
      looksLikeSyzmikTeeGarmentRow(item)
    ) {
      return "t-shirts";
    }
    const blob = workwearCategoryBrowseTextBlob(item);
    if (/\b(polo|pique)\b/i.test(blob)) {
      return "polos";
    }
    if (!looksLikeSyzmikWorkShirtsFormalOrWovenShirt(item)) {
      return "t-shirts";
    }
  }
  if (isWorkwearBrowseRowSyzmik(item) && resolved === "polos") {
    const csvTitle = syzmikCsvMarketingTitleForBrowseRow(item);
    if (
      (csvTitle != null && syzmikCsvTitleImpliesTee(csvTitle)) ||
      looksLikeSyzmikTeeGarmentRow(item)
    ) {
      return "t-shirts";
    }
  }
  if (resolved === "jackets" && looksLikeWorkwearJacketsToJumperRow(item)) {
    return "jumper";
  }
  if (resolved === "t-shirts" && looksLikeWorkwearTshirtsToJumperRow(item)) {
    return "jumper";
  }
  return resolved;
}

function resolveKidsCategoryBrowseSubSlug(resolved: string | null, item: CategoryBrowseProductRow): string | null {
  const kidsMeta = {
    slug: item.slug ?? null,
    category: item.category ?? null,
    description: item.description ?? null,
    supplier_name: item.supplier_name ?? null,
    audience: item.audience ?? null,
    storefront_hidden: item.storefront_hidden ?? null,
  };
  if (isTp3160bKidsPantsExclusiveListing(item.name, kidsMeta)) {
    return "pants";
  }
  if (isKidsLinePolosExclusiveCategoryBrowseListing(item.name, kidsMeta)) {
    return "polos";
  }
  if (isKidsJacketsJ307kJ3150bJ740kExclusiveListing(item.name, kidsMeta)) {
    return "jackets";
  }
  if (isKidsLineJacketsExclusiveCategoryBrowseListing(item.name, kidsMeta)) {
    return "jackets";
  }
  if (resolved == null || resolved === "") {
    return null;
  }
  return resolved;
}

function resolveMensCategoryBrowseSubSlug(resolved: string | null, item: CategoryBrowseProductRow): string | null {
  const mensRowMeta = {
    slug: item.slug ?? null,
    category: item.category ?? null,
    description: item.description ?? null,
    supplier_name: item.supplier_name ?? null,
    audience: item.audience ?? null,
    storefront_hidden: item.storefront_hidden ?? null,
  };
  if (isWv619mMensJumperExclusiveListing(item.name, mensRowMeta)) {
    return "jumper";
  }
  if (resolved == null || resolved === "") {
    return null;
  }
  if (isBisleyMensPantsExclusiveListing(item.name, mensRowMeta)) {
    return "pants";
  }
  if (isMensPantsS3fszMensJumperExclusiveListing(item.name, mensRowMeta)) {
    return "jumper";
  }
  if (resolved === "jackets" && looksLikeMensJacketsToJumperRow(item)) {
    return "jumper";
  }
  return resolved;
}

function resolveWomensCategoryBrowseSubSlug(resolved: string | null, item: CategoryBrowseProductRow): string | null {
  const womensExclusiveMeta = {
    slug: item.slug ?? null,
    category: item.category ?? null,
    description: item.description ?? null,
    supplier_name: item.supplier_name ?? null,
    audience: item.audience ?? null,
    storefront_hidden: item.storefront_hidden ?? null,
  };
  if (isWomensJacketsJ236ml3wsj1ExclusiveListing(item.name, womensExclusiveMeta)) {
    return "jackets";
  }
  if (resolved == null || resolved === "") {
    return null;
  }
  if (isBizCollectionWomensShirtsExclusiveListing(item.name, womensExclusiveMeta)) {
    return "shirts";
  }
  if (isFashionBizMensJacketsToWomensShirtsExclusiveListing(item.name, womensExclusiveMeta)) {
    return "shirts";
  }
  if (isFashionBizMensJumperToWomensJumperExclusiveListing(item.name, womensExclusiveMeta)) {
    return "jumper";
  }
  if (isFashionBizShirtsWomensExclusiveListing(item.name, womensExclusiveMeta)) {
    return "shirts";
  }
  if (isFashionBizPolosWomensExclusiveListing(item.name, womensExclusiveMeta)) {
    return "polos";
  }
  if (isBisleyWomensPantsExclusiveListing(item.name, womensExclusiveMeta)) {
    return "pants";
  }
  if (isWomensPantLinesExclusiveToWomensPantsOnlyListing(item.name, womensExclusiveMeta)) {
    return "pants";
  }
  if (
    resolved === "jackets" &&
    isWomensJacketsForceWomensJumperStyleCode(item.name, {
      slug: item.slug ?? null,
      category: item.category ?? null,
      description: item.description ?? null,
      supplier_name: item.supplier_name ?? null,
      audience: item.audience ?? null,
      storefront_hidden: item.storefront_hidden ?? null,
    })
  ) {
    return "jumper";
  }
  return resolved;
}

/** Products that would appear in any storefront sub-grid under this main category. */
export function filterProductsForMainCategoryBrowse(
  mainSlug: string,
  rows: CategoryBrowseProductRow[],
): CategoryBrowseProductRow[] {
  if (mainSlug === "special-offer") {
    return rows.filter((item) => {
      if (!hasStorefrontListNameAndPrice(item.name, item.base_price)) {
        return false;
      }
      if (getDiscountPercent(item.name) <= 0) {
        return false;
      }
      return isProductEligibleForSiteSearch(item.name, {
        slug: item.slug,
        category: item.category,
        description: item.description,
        storefront_hidden: item.storefront_hidden ?? null,
      });
    });
  }

  const allowedSubs = allowedSubSlugsForMain(mainSlug);
  if (allowedSubs.size === 0) {
    return [];
  }

  const isSyzmikOrBisleyWorkwearRow = (item: CategoryBrowseProductRow): boolean => {
    const sn = String(item.supplier_name ?? "").trim().toLowerCase();
    if (sn === "syzmik" || sn === "bisley") {
      return true;
    }
    const hay = `${item.name} ${item.slug ?? ""} ${item.description ?? ""}`.toLowerCase();
    return hay.includes("syzmik") || hay.includes("bisley");
  };

  return rows.filter((item) => {
    if (!hasStorefrontListNameAndPrice(item.name, item.base_price)) {
      return false;
    }
    const healthMeta = {
      slug: item.slug ?? null,
      category: item.category ?? null,
      description: item.description ?? null,
    };
    const resolved =
      mainSlug === "chef"
        ? resolveChefCategoryBrowseSubSlug(item)
        : mainSlug === HEALTH_CARE_MAIN_SLUG
          ? isHealthCareCatalogListing(item.name, healthMeta)
            ? resolveHealthCareBrowseSubSlug(item.name, healthMeta)
            : null
        : resolveProductSubSlug(item.name, item.category, item.slug, item.description) ??
          (mainSlug === "workwear" && isSyzmikOrBisleyWorkwearRow(item) ? "t-shirts" : null);

    const workwearResolved =
      mainSlug === "workwear"
        ? resolveWorkwearCategoryBrowseSubSlug(resolved, item)
        : mainSlug === "mens"
          ? resolveMensCategoryBrowseSubSlug(resolved, item)
          : mainSlug === "womens"
            ? resolveWomensCategoryBrowseSubSlug(resolved, item)
            : mainSlug === "kids"
              ? resolveKidsCategoryBrowseSubSlug(resolved, item)
              : resolved;

    const jbPpeMiscMeta = {
      slug: item.slug ?? null,
      category: item.category ?? null,
      description: item.description ?? null,
      supplier_name: item.supplier_name ?? null,
    };
    const effectiveResolved =
      mainSlug === "ppe" && isJbPpeMiscellaneousExclusiveListing(item.name, jbPpeMiscMeta)
        ? "miscellaneous"
        : workwearResolved;

    if (effectiveResolved == null) {
      return false;
    }

    // Workwear exception: always include Syzmik/Bisley even when the sub slug is PPE-only
    // (we still pass a stable sub slug to the card for styling).
    if (
      !allowedSubs.has(effectiveResolved) &&
      !(mainSlug === "workwear" && isSyzmikOrBisleyWorkwearRow(item))
    ) {
      return false;
    }

    return isProductVisibleInCategoryBrowse(mainSlug, effectiveResolved, item.name, {
      slug: item.slug,
      category: item.category,
      description: item.description,
      supplier_name: item.supplier_name ?? null,
      audience: item.audience ?? null,
      storefront_hidden: item.storefront_hidden ?? null,
    });
  });
}

/** Products for one main category row filtered to a single storefront sub (e.g. Workwear → Polos). */
export function filterProductsForSubCategoryBrowse(
  mainSlug: string,
  subSlug: string,
  rows: CategoryBrowseProductRow[],
): CategoryBrowseProductRow[] {
  const allowedSubs = allowedSubSlugsForMain(mainSlug);
  if (!allowedSubs.has(subSlug)) {
    return [];
  }
  return rows.filter((item) => {
    if (!hasStorefrontListNameAndPrice(item.name, item.base_price)) {
      return false;
    }
    const healthMetaSub = {
      slug: item.slug ?? null,
      category: item.category ?? null,
      description: item.description ?? null,
    };
    const resolved =
      mainSlug === "chef"
        ? resolveChefCategoryBrowseSubSlug(item)
        : mainSlug === HEALTH_CARE_MAIN_SLUG
          ? isHealthCareCatalogListing(item.name, healthMetaSub)
            ? resolveHealthCareBrowseSubSlug(item.name, healthMetaSub)
            : null
        : resolveProductSubSlug(item.name, item.category, item.slug, item.description) ??
          subSlugFromDbCategory(item.category) ??
          inferSubSlugFromNameHeuristics(item.name);

    const workwearResolved =
      mainSlug === "workwear"
        ? resolveWorkwearCategoryBrowseSubSlug(resolved, item)
        : mainSlug === "mens"
          ? resolveMensCategoryBrowseSubSlug(resolved, item)
          : mainSlug === "womens"
            ? resolveWomensCategoryBrowseSubSlug(resolved, item)
            : mainSlug === "kids"
              ? resolveKidsCategoryBrowseSubSlug(resolved, item)
              : resolved;
    const jbPpeMiscMetaSub = {
      slug: item.slug ?? null,
      category: item.category ?? null,
      description: item.description ?? null,
      supplier_name: item.supplier_name ?? null,
    };
    const effectiveResolvedSub =
      mainSlug === "ppe" && isJbPpeMiscellaneousExclusiveListing(item.name, jbPpeMiscMetaSub)
        ? "miscellaneous"
        : workwearResolved;
    const matches =
      effectiveResolvedSub === subSlug ||
      // Workwear > Shirts: include Work Shirts so Bisley work shirts appear under "Shirts" too.
      // Use workwearResolved so rows remapped to Pants / T-shirts / Polos do not stay in Shirts.
      (mainSlug === "workwear" && subSlug === "shirts" && workwearResolved === "work-shirts");
    if (!matches) {
      return false;
    }
    return isProductVisibleInCategoryBrowse(mainSlug, subSlug, item.name, {
      slug: item.slug,
      category: item.category,
      description: item.description,
      supplier_name: item.supplier_name ?? null,
      audience: item.audience ?? null,
      storefront_hidden: item.storefront_hidden ?? null,
    });
  });
}

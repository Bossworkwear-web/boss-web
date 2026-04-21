import { getSubCategoriesForMain } from "@/lib/catalog";
import { getDiscountPercent } from "@/lib/discounts";
import {
  hasStorefrontListNameAndPrice,
  isFashionBizChefLineListing,
  isProductEligibleForSiteSearch,
  isProductVisibleInCategoryBrowse,
  isYesChefCatalogProduct,
} from "@/lib/product-visibility";
import {
  inferSubSlugFromNameHeuristics,
  resolveProductSubSlug,
  subSlugFromDbCategory,
} from "@/lib/product-subslug";

export type CategoryBrowseProductRow = {
  id: string;
  name: string;
  base_price: number | null;
  image_urls?: string[] | null;
  category?: string | null;
  slug?: string | null;
  description?: string | null;
  storefront_hidden?: boolean | null;
  audience?: string | null;
  supplier_name?: string | null;
  available_colors?: string[] | null;
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
  if (/\b(tee|t-shirt|t shirt|singlet|tank top|tank\b|crew neck|v-neck|v neck|scoop neck|raglan)\b/i.test(blob)) {
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

function resolveWorkwearCategoryBrowseSubSlug(
  resolved: string | null,
  item: CategoryBrowseProductRow,
): string | null {
  if (resolved == null || resolved === "") {
    return null;
  }
  if (workwearSyzmikStyleForcedJumper(item)) {
    return "jumper";
  }
  if (workwearSyzmikStyleForcedTshirts(item)) {
    return "t-shirts";
  }
  if (isWorkwearBrowseRowSyzmik(item) && resolved === "work-shirts") {
    const blob = workwearCategoryBrowseTextBlob(item);
    if (/\b(polo|pique)\b/i.test(blob)) {
      return "polos";
    }
    if (!looksLikeSyzmikWorkShirtsFormalOrWovenShirt(item)) {
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
    const resolved =
      mainSlug === "chef"
        ? resolveChefCategoryBrowseSubSlug(item)
        : resolveProductSubSlug(item.name, item.category, item.slug, item.description) ??
          (mainSlug === "workwear" && isSyzmikOrBisleyWorkwearRow(item) ? "t-shirts" : null);

    const workwearResolved =
      mainSlug === "workwear" ? resolveWorkwearCategoryBrowseSubSlug(resolved, item) : resolved;

    if (workwearResolved == null) {
      return false;
    }

    // Workwear exception: always include Syzmik/Bisley even when the sub slug is PPE-only
    // (we still pass a stable sub slug to the card for styling).
    if (
      !allowedSubs.has(workwearResolved) &&
      !(mainSlug === "workwear" && isSyzmikOrBisleyWorkwearRow(item))
    ) {
      return false;
    }

    return isProductVisibleInCategoryBrowse(mainSlug, workwearResolved, item.name, {
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
    const resolved =
      mainSlug === "chef"
        ? resolveChefCategoryBrowseSubSlug(item)
        : resolveProductSubSlug(item.name, item.category, item.slug, item.description) ??
          subSlugFromDbCategory(item.category) ??
          inferSubSlugFromNameHeuristics(item.name);

    const workwearResolved =
      mainSlug === "workwear" ? resolveWorkwearCategoryBrowseSubSlug(resolved, item) : resolved;
    const matches =
      workwearResolved === subSlug ||
      // Workwear > Shirts: include Work Shirts so Bisley work shirts appear under "Shirts" too.
      (mainSlug === "workwear" && subSlug === "shirts" && resolved === "work-shirts");
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

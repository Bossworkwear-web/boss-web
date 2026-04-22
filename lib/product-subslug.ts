import { bizCareListingStyleCode, isBizCareListingInMiscGeneratedSet } from "@/lib/biz-care-misc-route";
import bizCollectionForceJacketsCodes from "@/lib/biz-collection-force-jackets.json";
import bizCollectionForcePantsCodes from "@/lib/biz-collection-force-pants.json";
import bizCollectionKidsOnlyJacketsCodes from "@/lib/biz-collection-kids-only-jackets.json";
import bizCollectionKidsOnlyPantsCodes from "@/lib/biz-collection-kids-only-pants.json";
import bizCollectionKidsOnlyTShirtsCodes from "@/lib/biz-collection-kids-only-t-shirts.json";
import fashionBizWomensTShirtsCodes from "@/lib/fashion-biz-womens-t-shirts.json";
import { isBizCareOrCollectionListing } from "@/lib/fashion-biz-gender-route";
import { isKidsOnlyTshirtT10032Product } from "@/lib/product-visibility";
import { FASHION_BIZ_LISTING_SUBSLUG } from "@/lib/fashion-biz-listing-subslug.generated";
import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import {
  isBagKeywordProduct,
  isBizCareCatalogProduct,
  isBizCareHatLikeProduct,
  isHeadWearKeywordProduct,
  isSocksKeywordProduct,
  isSyzmikCatalogProduct,
  isSyzmikZaPpeMiscListing,
} from "@/lib/product-visibility";

export { bizCareListingStyleCode };

/** Hi-vis / safety vests → Workwear `hi-vis-vest` (name-only heuristics). */
export function isHiVisVestListingName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!/\bvests?\b/.test(n)) {
    return false;
  }
  if (/\b(hi[\s-]*vis|high[\s-]*vis|hivis)\b/.test(n)) {
    return true;
  }
  if (/\b(safety|reflective|rail)\s+vest\b/i.test(name)) {
    return true;
  }
  if (/\bvest\b/.test(n) && /\b(hoop|segmented)\s+taped\b/.test(n)) {
    return true;
  }
  if (/\bvest\b/.test(n) && /\b(vic|nsw)\s+rail\b/.test(n)) {
    return true;
  }
  return false;
}

/** Supplier titles like "Mens Cargo Pant" under DB Shirts → list under Pants (not Shirts). */
function nameIndicatesMensPantsProduct(name: string): boolean {
  const lower = name.toLowerCase();
  const hasMens =
    /\bmens\b/i.test(name) ||
    /\bmen['\u2019]s\b/i.test(lower);
  if (!hasMens) {
    return false;
  }
  const pantsLike =
    /\b(pants?|trousers?|joggers?|overalls?)\b/i.test(lower) ||
    /\bshorts?\b/i.test(lower) ||
    /\b(cargo|work|utility)\s+(pants?|trousers?|shorts?)\b/i.test(lower) ||
    /\b(cargo|work|utility)\b/i.test(lower) ||
    /\bmulti\s*pocket\b/i.test(lower) ||
    /\bmulti\s*pkt\b/i.test(lower);
  if (!pantsLike) {
    return false;
  }
  // If it's clearly a shirt, don't mis-route.
  if (/\bshirt\b/i.test(lower) && !/\bpants?\b/i.test(lower)) {
    return false;
  }
  return true;
}

/** Biz Collection lines with TP in the style / title → Men's/Pants (see `fashionBizListingGenderAudience`). */
function isBizCollectionTpPantsListing(name: string, styleCode: string | null): boolean {
  if (!name.toLowerCase().includes("biz collection")) {
    return false;
  }
  if (styleCode && styleCode.toUpperCase().includes("TP")) {
    return true;
  }
  return name.toUpperCase().includes("TP");
}

const BIZ_COLLECTION_FORCE_JACKETS_CODES = new Set(
  (bizCollectionForceJacketsCodes as readonly string[]).map((c) => c.toUpperCase()),
);

const BIZ_COLLECTION_KIDS_ONLY_JACKETS_CODES = new Set(
  (bizCollectionKidsOnlyJacketsCodes as readonly string[]).map((c) => c.toUpperCase()),
);

const BIZ_COLLECTION_FORCE_PANTS_CODES = new Set(
  (bizCollectionForcePantsCodes as readonly string[]).map((c) => c.toUpperCase()),
);

const BIZ_COLLECTION_KIDS_ONLY_PANTS_CODES = new Set(
  (bizCollectionKidsOnlyPantsCodes as readonly string[]).map((c) => c.toUpperCase()),
);

const BIZ_COLLECTION_KIDS_ONLY_T_SHIRTS_CODES = new Set(
  (bizCollectionKidsOnlyTShirtsCodes as readonly string[]).map((c) => c.toUpperCase()),
);

const FASHION_BIZ_WOMENS_T_SHIRTS_CODES = new Set(
  (fashionBizWomensTShirtsCodes as readonly string[]).map((c) => c.toUpperCase()),
);

/**
 * Map `products.category` (admin / import labels) to storefront sub slugs.
 */
export function subSlugFromDbCategory(category: string | null | undefined): string | null {
  if (category == null || !String(category).trim()) {
    return null;
  }
  const key = String(category).trim().toLowerCase().replace(/\s+/g, " ");

  const exact: Record<string, string> = {
    "t-shirts": "t-shirts",
    "t shirts": "t-shirts",
    "polos": "polos",
    shirts: "shirts",
    "dress shirts": "shirts",
    "work shirts": "work-shirts",
    jackets: "jackets",
    jumper: "jumper",
    jumpers: "jumper",
    pants: "pants",
    trousers: "pants",
    scrubs: "scrubs",
    chef: "chef",
    "chef wear": "chef",
    apron: "apron",
    aprons: "apron",
    boots: "boots",
    glove: "glove",
    gloves: "glove",
    "safty glasses": "safty-glasses",
    "safety glasses": "safty-glasses",
    "hi-vis vest": "hi-vis-vest",
    "hi vis vest": "hi-vis-vest",
    "head wear": "head-wear",
    headwear: "head-wear",
    miscellaneous: "miscellaneous",
    misc: "miscellaneous",
    other: "miscellaneous",
    "ppe miscellaneous": "miscellaneous",
  };

  if (exact[key]) {
    return exact[key];
  }

  if (key.includes("work shirt") || key.includes("workshirt")) {
    return "work-shirts";
  }
  if (key.includes("t-shirt") || key.includes("t shirt")) {
    return "t-shirts";
  }
  if (key.includes("polo")) {
    return "polos";
  }
  if (key.includes("scrub")) {
    return "scrubs";
  }
  if (key.includes("jacket")) {
    return "jackets";
  }
  if (key.includes("jumper")) {
    return "jumper";
  }
  if (key.includes("pant") || key.includes("trouser")) {
    return "pants";
  }
  if (key.includes("chef")) {
    return "chef";
  }
  if (key.includes("apron")) {
    return "apron";
  }
  if (key.includes("sock")) {
    return "miscellaneous";
  }
  if (key.includes("boot")) {
    return "boots";
  }
  if (key.includes("glove")) {
    return "glove";
  }
  if (key.includes("glass")) {
    return "safty-glasses";
  }
  if (key.includes("vest")) {
    if (
      key.includes("hi-vis") ||
      key.includes("hi vis") ||
      key.includes("high vis") ||
      key.includes("reflective") ||
      key.includes("safety")
    ) {
      return "hi-vis-vest";
    }
    return "miscellaneous";
  }
  if (
    key.includes("helmet") ||
    key.includes("hard hat") ||
    key.includes("hardhat") ||
    key.includes("bump cap") ||
    key.includes("balaclava")
  ) {
    return "head-wear";
  }
  if (key.includes("miscellaneous") || /\bmisc\b/.test(key) || key === "other ppe" || key === "ppe other") {
    return "miscellaneous";
  }
  if (/\b(bag|bags|tote|backpack|rucksack|satchel)\b/.test(key) || key.includes("handbag")) {
    return "miscellaneous";
  }

  return null;
}

/**
 * Heuristic sub slug from product title only (no DB category).
 * Order matters: `shirt` must not steal `t-shirt` / `work shirt` / `polo shirt` style matches.
 */
export function inferSubSlugFromNameHeuristics(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("apron")) {
    return "apron";
  }
  if (/\bsocks?\b/i.test(normalized)) {
    return "miscellaneous";
  }
  if (/\b(bag|bags|tote|backpack|rucksack|satchel)\b/i.test(name)) {
    return "miscellaneous";
  }
  if (
    normalized.includes("t-shirt") ||
    normalized.includes("tee shirt") ||
    normalized.includes("t shirt") ||
    /\bt\s*shirt\b/i.test(name) ||
    /\btee\b/i.test(name)
  ) {
    return "t-shirts";
  }
  if (normalized.includes("work shirt") || normalized.includes("work-shirt")) {
    return "work-shirts";
  }
  if (normalized.includes("polo")) {
    return "polos";
  }
  if (normalized.includes("boot")) {
    return "boots";
  }
  if (normalized.includes("glove")) {
    return "glove";
  }
  if (isHiVisVestListingName(name)) {
    return "hi-vis-vest";
  }
  if (/\bvests?\b/.test(normalized)) {
    return "miscellaneous";
  }
  if (normalized.includes("glass")) {
    return "safty-glasses";
  }
  if (
    normalized.includes("pant") ||
    normalized.includes("trouser") ||
    /\bshorts\b/i.test(normalized) ||
    /\bjoggers?\b/i.test(normalized) ||
    /\boveralls?\b/i.test(normalized) ||
    /\bleggings?\b/i.test(normalized) ||
    /\bcargo\s+(pant|trouser|short)/i.test(normalized)
  ) {
    return "pants";
  }
  if (
    normalized.includes("jacket") ||
    /\b(anorak|blazer|parka|windbreaker|bomber|softshell|hardshell)\b/i.test(normalized)
  ) {
    return "jackets";
  }
  if (normalized.includes("scrub")) {
    return "scrubs";
  }
  if (normalized.includes("chef")) {
    return "chef";
  }
  if (
    /\b(hoodie|hoody|hoodies)\b/i.test(normalized) ||
    /\bsweatshirt\b/i.test(normalized) ||
    /\b(fleece|jumper|sweater|cardigan|pullover)\b/i.test(normalized) ||
    /\bknit(?:ted|wear)?\b/i.test(normalized) ||
    normalized.includes("base layer") ||
    /\bthermal\b/i.test(normalized)
  ) {
    return "jackets";
  }
  if (normalized.includes("shirt")) {
    return "shirts";
  }
  /** Default: unknown short tops often omit "tee" in supplier titles. */
  return "t-shirts";
}

function headWearFromName(name: string): boolean {
  const normalized = name.toLowerCase();
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

/**
 * Sub slug for category grids. Uses `category` when present, then title heuristics.
 */
export function resolveProductSubSlug(
  name: string,
  category: string | null | undefined,
  storeSlug?: string | null,
  description?: string | null,
): string {
  const catMeta = { category };

  /** JB's Wear 5BSNP bib apron: requested to list under Chef → Apron. */
  const jbApronHay = `${name} ${storeSlug ?? ""}`.toUpperCase();
  if (/\b5BSNP\b/.test(jbApronHay)) {
    return "apron";
  }

  /** Biz Collection BS722M: requested to list under Men's → Jackets. */
  const bs722mHay = `${name} ${storeSlug ?? ""}`.toUpperCase();
  if (/\bBS722M\b/.test(bs722mHay)) {
    return "jackets";
  }

  /** Biz Care CT247ML: requested to list under Men's → T-shirts. */
  const ct247mlHay = `${name} ${storeSlug ?? ""}`.toUpperCase();
  if (/\bCT247ML\b/.test(ct247mlHay)) {
    return "t-shirts";
  }

  /** Polo products sometimes leak into T-shirts when DB category is wrong; prefer Polos when text says "polo". */
  const poloHay = `${name} ${storeSlug ?? ""} ${category ?? ""} ${description ?? ""}`.toLowerCase();
  if (/\bpolo\b/.test(poloHay) && !/\bpoloneck\b/.test(poloHay)) {
    return "polos";
  }

  /** PPE accessories sometimes leak into Men's/T-shirts. Keep them under PPE → Miscellaneous. */
  const ppeAccessoryHay = `${name} ${storeSlug ?? ""} ${description ?? ""}`.toLowerCase();
  if (
    /\bear\s*muffs?\b/.test(ppeAccessoryHay) ||
    /\bknee\s*pads?\b/.test(ppeAccessoryHay) ||
    /\bear\s*plugs?\b/.test(ppeAccessoryHay) ||
    /\bfoot\s*bed\b/.test(ppeAccessoryHay) ||
    /\bfootbed\b/.test(ppeAccessoryHay)
  ) {
    return "miscellaneous";
  }

  /** Safety glasses often show up as "Spec/Specs" in supplier titles. Route to PPE → Safty Glasses. */
  const specHay = `${name} ${storeSlug ?? ""} ${category ?? ""} ${description ?? ""}`.toLowerCase();
  if (
    /\b(spec|specs|spectacles)\b/.test(specHay) &&
    !/\bspecification(s)?\b/.test(specHay)
  ) {
    return "safty-glasses";
  }

  /** Shoes should list under PPE → Boots (not under Men's/T-shirts). */
  const shoeHay = `${name} ${storeSlug ?? ""} ${category ?? ""} ${description ?? ""}`.toLowerCase();
  if (/\bshoes?\b/.test(shoeHay) || /\bsneakers?\b/.test(shoeHay)) {
    return "boots";
  }

  /** Rugby tops should list under Polos (not under T-shirts). */
  const rugbyHay = `${name} ${storeSlug ?? ""} ${category ?? ""} ${description ?? ""}`.toLowerCase();
  if (
    /\brugby\b/.test(rugbyHay) &&
    !/\bshorts?\b/.test(rugbyHay) &&
    !/\b(pant|pants|trouser|trousers|jogger|joggers|overalls?)\b/.test(rugbyHay)
  ) {
    return "polos";
  }

  /** Bisley BB101: must list under PPE → Miscellaneous only (see `isProductVisibleInCategoryBrowse` exception). */
  const bb101Hay = `${name} ${storeSlug ?? ""}`.toUpperCase();
  if (/\bBB101\b/.test(bb101Hay)) {
    return "miscellaneous";
  }

  /** Bisley BS6404: requested to list under Men's → Polos (see `isProductVisibleInCategoryBrowse` exception). */
  const bs6404Hay = `${name} ${storeSlug ?? ""}`.toUpperCase();
  if (/\bBS6404\b/.test(bs6404Hay)) {
    return "polos";
  }

  /** JB knit vests: requested to list under Men's → Jumper (not under Workwear/Hi-vis Vest). */
  const jbKnitVestHay = `${name} ${storeSlug ?? ""}`.toUpperCase();
  if (/\b6ATV\b/.test(jbKnitVestHay) || /\b6V\b/.test(jbKnitVestHay)) {
    return "jumper";
  }

  /** Biz Care CID940U: requested to list under PPE → Miscellaneous. */
  const cid940uHay = `${name} ${storeSlug ?? ""}`.toUpperCase();
  if (/\bCID940U\b/.test(cid940uHay)) {
    return "miscellaneous";
  }

  if (isSocksKeywordProduct(name, catMeta)) {
    return "miscellaneous";
  }
  if (isBagKeywordProduct(name, catMeta)) {
    return "miscellaneous";
  }

  if (isBizCareListingInMiscGeneratedSet(name, storeSlug)) {
    return "miscellaneous";
  }

  if (isBizCareCatalogProduct(name, catMeta) && isBizCareHatLikeProduct(name, catMeta)) {
    return "miscellaneous";
  }
  if (isHiVisVestListingName(name)) {
    return "hi-vis-vest";
  }
  if (isHeadWearKeywordProduct(name)) {
    return "head-wear";
  }
  if (headWearFromName(name)) {
    return "head-wear";
  }

  if (
    isKidsOnlyTshirtT10032Product(name, {
      slug: storeSlug ?? null,
      category: category ?? null,
      description: description ?? null,
    })
  ) {
    return "t-shirts";
  }

  const listingStyleCode = fashionBizStyleCodeFromListing(name, storeSlug ?? null);
  if (
    listingStyleCode &&
    FASHION_BIZ_WOMENS_T_SHIRTS_CODES.has(listingStyleCode) &&
    isBizCareOrCollectionListing(name, storeSlug ?? null, category ?? null)
  ) {
    return "t-shirts";
  }
  if (
    listingStyleCode &&
    (BIZ_COLLECTION_FORCE_PANTS_CODES.has(listingStyleCode) ||
      BIZ_COLLECTION_KIDS_ONLY_PANTS_CODES.has(listingStyleCode))
  ) {
    return "pants";
  }
  if (isBizCollectionTpPantsListing(name, listingStyleCode)) {
    return "pants";
  }
  if (
    listingStyleCode &&
    (BIZ_COLLECTION_FORCE_JACKETS_CODES.has(listingStyleCode) ||
      BIZ_COLLECTION_KIDS_ONLY_JACKETS_CODES.has(listingStyleCode))
  ) {
    return "jackets";
  }
  if (listingStyleCode && BIZ_COLLECTION_KIDS_ONLY_T_SHIRTS_CODES.has(listingStyleCode)) {
    return "t-shirts";
  }

  /** ZWL contains ZW — match ZWL before ZW. */
  if (isSyzmikCatalogProduct(name, catMeta) && name.toUpperCase().includes("ZWL")) {
    return "pants";
  }
  /** Syzmik ZW… lines → Workwear/Shirts (DB + sync also set `Shirts`). */
  if (isSyzmikCatalogProduct(name, catMeta) && name.toUpperCase().includes("ZW")) {
    return "shirts";
  }
  if (isSyzmikZaPpeMiscListing(name, catMeta)) {
    return "miscellaneous";
  }

  const fromCategory = subSlugFromDbCategory(category);
  if (fromCategory === "t-shirts") {
    const csvSub = listingStyleCode ? FASHION_BIZ_LISTING_SUBSLUG[listingStyleCode] : undefined;
    if (csvSub !== undefined && csvSub !== "t-shirts") {
      return csvSub;
    }
    const inferred = inferSubSlugFromNameHeuristics(name);
    return inferred !== "t-shirts" ? inferred : "t-shirts";
  }
  if (fromCategory === "pants") {
    const inferred = inferSubSlugFromNameHeuristics(name);
    if (inferred === "jackets") {
      return "jackets";
    }
    /** CSV/folder sometimes tags shirts as Pants; title heuristics fix Workwear/Shirts grid. */
    if (
      isSyzmikCatalogProduct(name, catMeta) &&
      (inferred === "shirts" || inferred === "work-shirts")
    ) {
      return "shirts";
    }
    return "pants";
  }
  if (fromCategory === "jackets") {
    const inferred = inferSubSlugFromNameHeuristics(name);
    return inferred === "pants" ? "pants" : "jackets";
  }
  if (
    (fromCategory === "shirts" || fromCategory === "work-shirts") &&
    nameIndicatesMensPantsProduct(name)
  ) {
    return "pants";
  }
  if (fromCategory === "shirts" || fromCategory === "work-shirts") {
    const inferred = inferSubSlugFromNameHeuristics(name);
    // Mis-bucketed jackets in supplier folders / CSV imports should not stay under Shirts.
    if (inferred === "jackets") {
      return "jackets";
    }
  }
  if (fromCategory) {
    return fromCategory;
  }

  /** Men's / Women's / Kid's: Biz Care defaults to Scrubs when DB has no more specific category. */
  if (isBizCareCatalogProduct(name)) {
    return "scrubs";
  }

  return inferSubSlugFromNameHeuristics(name);
}

/** Client / nav: name + optional slug (no DB category). */
export function inferSubSlugFromProductName(name: string, storeSlug?: string | null): string {
  return resolveProductSubSlug(name, null, storeSlug);
}

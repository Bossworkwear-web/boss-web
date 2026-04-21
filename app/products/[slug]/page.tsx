import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";

import { getDiscountPercent } from "@/lib/discounts";
import { storefrontRetailFromSupplierBaseOrFallback } from "@/lib/product-price";
import { isBizCorporatesCatalogProduct } from "@/lib/product-visibility";
import { slugifyProductNameForPath } from "@/lib/product-path-slug";
import { storefrontDescriptionForDisplay } from "@/lib/product-display-name";
import { createSupabaseClient } from "@/lib/supabase";

import { normalizeProductSizeOptions } from "@/lib/product-sizes";
import { getGoogleRatingForProductSlug } from "@/lib/product-google-rating";

import type { PlacementData, ProductDetailData } from "../premium-work-polo/premium-work-polo-client";

import { PremiumWorkPoloClientDynamic } from "./premium-work-polo-client-dynamic";

export const dynamic = "force-dynamic";

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

function normalizeColors(raw: string[] | null | undefined, fallback: string[]) {
  const cleaned = (raw ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, 20);

  if (cleaned.length >= 2) {
    return cleaned;
  }

  return fallback.slice(0, 20);
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
  for (const url of imageUrls) {
    if (typeof url !== "string") continue;
    const file = decodeURIComponent(url.split("/").pop() ?? url);
    const fileNoQuery = (file.split("?")[0] ?? file).trim();
    // Only derive colour options from product shots. "Talent" images are on-model/marketing,
    // and may include hero-only variants that should not create extra colour buttons.
    if (/_Talent_/i.test(fileNoQuery)) {
      continue;
    }
    const token = extractColorTokenFromFilename(fileNoQuery);
    if (!token) continue;
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
        continue;
      }
    }

    const human = humanizeColorToken(token);
    if (!human) continue;

    const words = human
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean);

    // Heuristic: if every word is a simple color word, treat it as a combo color (Black / Gold / White).
    if (words.length >= 2 && words.every((w) => SIMPLE_COLOR_WORDS.has(w))) {
      out.push(formatComboColorFromWords(words));
      continue;
    }

    // Otherwise keep the humanised token as-is (e.g. "Midnight Navy" stays a single colour name).
    out.push(human);
  }
  return out
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 30);
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
  "id, name, base_price, slug, category, description, features, specifications, image_urls, available_colors, available_sizes, supplier_name, storefront_hidden";
const PRODUCT_SELECT_MID =
  "id, name, base_price, slug, category, description, image_urls, available_colors, available_sizes, storefront_hidden";
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

    const listRetailAfterMarkup = storefrontRetailFromSupplierBaseOrFallback(product.base_price, 25.0);
    const discountPercent = getDiscountPercent(product.name);
    const basePrice =
      discountPercent > 0 ? listRetailAfterMarkup * (1 - discountPercent / 100) : listRetailAfterMarkup;

    const dbDescription =
      product.description != null && String(product.description).trim().length > 0
        ? String(product.description).trim()
        : null;

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

    const supplierNameRaw =
      "supplier_name" in product && product.supplier_name != null
        ? String(product.supplier_name).trim()
        : "";

    const normalizedImageUrls =
      product.image_urls && product.image_urls.length > 0
        ? product.image_urls
        : [
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80",
            "https://images.unsplash.com/photo-1592878940526-0214b0f374f6?auto=format&fit=crop&w=1200&q=80",
          ];

    const normalizedColorOptions = normalizeColors(product.available_colors, fallbackColors);
    const derivedFromImages = deriveColorOptionsFromImageUrls(normalizedImageUrls);
    // Prefer derived combo colours (e.g. "Black / Gold") when we can extract them from filenames.
    const derivedHasCombo = derivedFromImages.some(isComboColorLabel);
    const dbHasCombo = normalizedColorOptions.some(isComboColorLabel);
    const colorOptionsEffective =
      derivedHasCombo && !dbHasCombo ? derivedFromImages : normalizedColorOptions;
    const mappedProduct: ProductDetailData = {
      id: product.id,
      name: product.name,
      slug: product.slug?.trim() ? product.slug : slug,
      category: product.category ?? inferCategoryFromName(product.name),
      ...(supplierNameRaw ? { supplierName: supplierNameRaw } : {}),
      description:
        dbDescription ?? "Reliable workwear configured for your branding needs.",
      basePrice: Math.round(basePrice * 100) / 100,
      ...(discountPercent > 0 && { originalPrice: listRetailAfterMarkup }),
      imageUrls: normalizedImageUrls,
      colorOptions: colorOptionsEffective,
      sizeOptions: normalizeProductSizeOptions(
        product.available_sizes,
        product.name,
        "slug" in product ? product.slug : null,
        "category" in product ? product.category : null,
      ),
      ...(googleRating ? { googleRating } : {}),
      ...(dbFeatures ? { features: dbFeatures } : {}),
      ...(dbSpecifications ? { specifications: dbSpecifications } : {}),
    };

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
  return unstable_cache(
    async () => getDetailDataInternal(slug),
    ["storefront-pdp-v1", slug],
    { revalidate: 120 },
  )();
}

function formatUsdMeta(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Link / search snippets: use storefront retail (same as `getDetailData`), not raw supplier `base_price`. */
export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getDetailData(slug);
  if (!detail) {
    return { title: "Product" };
  }
  const { product } = detail;
  const title = product.name;
  const sale = product.basePrice;
  const was = product.originalPrice;
  const pricePhrase =
    was != null ? `List ${formatUsdMeta(was)} · from ${formatUsdMeta(sale)}` : `From ${formatUsdMeta(sale)}`;
  const plainDesc = (product.description ?? "").replace(/\s+/g, " ").trim();
  const clipped = plainDesc.length > 140 ? `${plainDesc.slice(0, 137)}…` : plainDesc;
  const description = clipped.length > 0 ? `${pricePhrase}. ${clipped}` : pricePhrase;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const detailData = await getDetailData(slug);

  if (!detailData) {
    notFound();
  }

  return (
    <PremiumWorkPoloClientDynamic product={detailData.product} placements={detailData.placements} />
  );
}

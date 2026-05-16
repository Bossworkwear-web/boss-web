"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ArrowLeftIcon, ArrowRightIcon, CalculatorIcon, PlacementIcon, UploadIcon } from "@/app/components/icons";
import {
  BISLEY_POSITIONAL_GALLERY_COLOR_LABELS,
  bisleyReorderDrillImagesToMatchColors,
  bisleyPositionalNormalizedCodesFromUrls,
  bisleySlugUsesPositionalColorGallery,
  bisleySortedPositionalImageUrlsIfComplete,
} from "@/lib/bisley-positional-color-gallery";
import { filterAp2211ColorOptions, isStorefrontAp2211Slug } from "@/lib/ap-2211-storefront";
import { filterAp3309ColorOptions, isStorefrontAp3309Slug } from "@/lib/ap-3309-storefront";
import { isPpeStorefrontProduct } from "@/lib/catalog";
import { STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";
import { storefrontLeadingSupplierBrand } from "@/lib/product-display-name";
import { restrictBisleyOrangeOnlyProductColorsIfNeeded } from "@/lib/product-visibility";
import { STORE_MAIN_SHELL_CLASS } from "@/lib/store-main-shell";
import { SITE_PAGE_INSET_X_CLASS } from "@/lib/site-layout";
import {
  applyBizCollectionP29012ColorDisplayRules,
  isBizCollectionP29012Listing,
} from "@/lib/biz-collection-p29012-color-options";
import { isBizCareOrCollectionListing, isBizCollectionListing } from "@/lib/fashion-biz-gender-route";
import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import {
  BIZ_COLLECTION_DETAIL_METADATA_STYLE_BASES,
  BIZ_COLLECTION_GROUP_METADATA_STYLE_BASES,
  isBizCareCid940uExcludedColourChip,
  isBizCollectionDetailMetadataColourChip,
  isBizCollectionGroupMetadataColourChip,
} from "@/lib/biz-collection-metadata-colour-chips";
import { uploadStoreCheckoutReferenceImages } from "@/app/orders/actions";
import { addCartItem, getCartItems, removeCartItem, updateCartItem, type CartItem } from "@/lib/cart";
import { productPathSegment } from "@/lib/product-path-slug";
import {
  bisleyPdpDisplayProductNameWithApexPrefix,
  productCardDisplayLines,
  productDetailDescriptionBody,
} from "@/lib/product-card-copy";
import {
  getSizeGuideBundle,
  inferSizeGuideKind,
  SIZE_GUIDE_SUPPLIER_WEBSITE_FOOTNOTE,
  sizeGuideToPlainText,
  type SizeGuideBundle,
} from "@/lib/product-size-guide";
import {
  appendSupplierLinksToPlainText,
  resolveSupplierSizeChartLinks,
  type SupplierSizeChartLink,
} from "@/lib/supplier-size-chart-links";
import { placementLogoLocationSrc } from "@/lib/placement-logo-location";
import { storefrontVolumeDiscountRateFromSubtotalAud } from "@/lib/storefront-volume-discount";
import {
  filterPlacementsForSpecialDealPackage,
  resolveActiveSpecialDealPackageForProduct,
  type StorefrontSpecialDealPackage,
} from "@/lib/storefront-special-deal-packages";
import { specialDealPackageNote } from "@/lib/storefront-special-deal-package-cart";
import { syncSidebarNavFromProductIfNeeded } from "@/lib/sidebar-nav";
import {
  isStorefrontYesChefCh234mPdp,
  isYesChefCh234mExcludedColourChip,
} from "@/lib/yes-chef-ch234m-pdp-colour";
import type { ProductGoogleRating } from "@/lib/product-google-rating";

type ServiceType = "Plain" | "Embroidery" | "Printing";

type PlacementOption = {
  id: string;
  label: string;
  short: string;
  /** Two-letter code for diagram asset (RC stays `RC` even when `short` is “RC for Names”). */
  diagramAbbr: string;
  embroideryCost: number;
  printingCost: number;
};

type DecoratedServiceType = Exclude<ServiceType, "Plain">;

/** §3 Service Type — raster artwork in `public/button/` (idle). */
const SERVICE_TYPE_BUTTON_IMAGE: Record<ServiceType, string> = {
  Plain: "/button/Button_Plain.png",
  /** Filenames in `public/button/` use legacy typo `Buttom_` — keep in sync with on-disk assets. */
  Embroidery: "/button/Buttom_Emb.png",
  Printing: "/button/Button_Print.png",
};

/** Pressed / selected: same folder, `*_2.png` (pressed artwork). */
const SERVICE_TYPE_BUTTON_IMAGE_SELECTED: Record<ServiceType, string> = {
  Plain: "/button/Button_Plain_2.png",
  Embroidery: "/button/Buttom_Emb_2.png",
  Printing: "/button/Button_Print_2.png",
};

/** Soft drop shadow behind each §3 artwork button (idle). */
const SERVICE_TYPE_BUTTON_SHADOW_IDLE: Record<ServiceType, string> = {
  Plain:
    "shadow-[0_5px_18px_-5px_rgba(0,31,63,0.22),0_2px_8px_-2px_rgba(0,31,63,0.12)]",
  Embroidery:
    "shadow-[0_5px_18px_-5px_rgba(255,133,27,0.26),0_2px_8px_-2px_rgba(255,133,27,0.13)]",
  Printing:
    "shadow-[0_5px_18px_-5px_rgba(59,130,246,0.28),0_2px_8px_-2px_rgba(59,130,246,0.14)]",
};

type LogoAttachmentRow = {
  key: string;
  file: File;
  /** Object URL for image previews only; empty for PDF / AI. */
  previewUrl: string;
};

const MAX_LOGO_FILES = 8;
const MAX_LOGO_BYTES = 20 * 1024 * 1024;

function isAllowedLogoFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) {
    return true;
  }
  if (t === "application/pdf") {
    return true;
  }
  if (t === "application/postscript" || t.includes("illustrator") || t.includes("eps")) {
    return true;
  }
  const n = file.name.toLowerCase();
  return /\.(pdf|ai|eps)$/i.test(n);
}

function logoAttachmentsFlushReducer(prev: LogoAttachmentRow[]): LogoAttachmentRow[] {
  for (const r of prev) {
    if (r.previewUrl) {
      URL.revokeObjectURL(r.previewUrl);
    }
  }
  return [];
}

export type PlacementData = {
  id: string;
  name: string;
};

export type ProductDetailData = {
  id: string;
  name: string;
  category: string;
  /** Store / URL slug when present (e.g. syzmik in sku slug). */
  slug?: string | null;
  /** `products.supplier_name` — shown on Admin → Supplier orders. */
  supplierName?: string;
  /**
   * Server-computed PDP header snapshot (prevents hydration mismatches when dev bundles diverge).
   * When present, the PDP should prefer these over re-deriving from `name` on the client.
   */
  displayProductName?: string | null;
  displayProductCode?: string | null;
  displayBrandSkuLine?: string | null;
  /** Server-computed colour list for PDP (preferred over client re-derivation). */
  displayColorOptions?: string[];
  /**
   * Server-computed `productDetailDescriptionBody` output — use on the client so SSR HTML matches hydration
   * (same code path as RSC, avoids bundle/Turbopack drift for Aussie strip etc.).
   */
  pdpDescriptionBody?: string;
  description: string;
  basePrice: number;
  originalPrice?: number;
  imageUrls: string[];
  colorOptions: string[];
  sizeOptions: string[];
  /** From `data/product-google-ratings.json` or Google Places (store listing). */
  googleRating?: ProductGoogleRating;
  /** `products.features` — bullet-style selling points (plain text). */
  features?: string;
  /** `products.specifications` — fabric, sizing detail, etc. (plain text). */
  specifications?: string;
  relatedProducts?: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
  }>;
};

export type PremiumWorkPoloClientProps = {
  product: ProductDetailData;
  placements: PlacementData[];
  /**
   * Same string as `product.pdpDescriptionBody`, passed from the RSC page so the Flight payload always
   * includes the server-rendered DESCRIPTION (avoids stale `unstable_cache` entries without the nested field).
   */
  serverPdpDescriptionBody?: string;
};

function effectivePdpColorOptions(product: ProductDetailData): string[] {
  const restrictMeta = {
    slug: product.slug ?? null,
    supplier_name: product.supplierName ?? null,
    description: product.description ?? null,
  };
  const slugLower = (product.slug ?? "").trim().toLowerCase();
  const urls = product.imageUrls ?? [];
  if (bisleySlugUsesPositionalColorGallery(slugLower) && urls.length >= 4) {
    if (bisleyPositionalNormalizedCodesFromUrls(urls).size === 4) {
      return restrictBisleyOrangeOnlyProductColorsIfNeeded(product.name, restrictMeta, [
        ...BISLEY_POSITIONAL_GALLERY_COLOR_LABELS,
      ]);
    }
  }

  const raw =
    Array.isArray(product.displayColorOptions) && product.displayColorOptions.length > 0
      ? product.displayColorOptions
      : product.colorOptions;
  let restricted = restrictBisleyOrangeOnlyProductColorsIfNeeded(product.name, restrictMeta, raw);
  // Bisley BPC8580/BPC8580T: chip label should be Navy (not Orange).
  if (slugLower.includes("bpc8580") || slugLower.includes("bpc8580t")) {
    restricted = restricted.map((c) => (String(c).trim().toLowerCase() === "orange" ? "Navy" : c));
  }
  // Bisley BSHC1333: force chip order to match image order.
  if ((slugLower.includes("bshc1333") || slugLower.includes("bsh1331")) && restricted.length >= 5) {
    const canonical = ["Black", "Charcoal", "Green", "Navy", "Stone"];
    const have = new Set(restricted.map((c) => String(c).trim().toLowerCase()));
    if (canonical.every((c) => have.has(c.toLowerCase()))) {
      restricted = canonical;
    }
  }
  // Bisley BSHC1332: force chip order to match image order.
  if (slugLower.includes("bshc1332") && restricted.length >= 4) {
    const canonical = ["Black", "Green", "Navy", "Stone"];
    const have = new Set(restricted.map((c) => String(c).trim().toLowerCase()));
    if (canonical.every((c) => have.has(c.toLowerCase()))) {
      restricted = canonical;
    }
  }
  // Syzmik ZJ260: `Product_Multi` gallery assets are not a purchasable colour.
  if (slugLower.includes("zj260")) {
    return restricted.filter((c) => String(c).trim().toLowerCase() !== "multi");
  }
  {
    const fbStyle = fashionBizStyleCodeFromListing(product.name, product.slug ?? null);
    const styleBase = fbStyle ? fbStyle.replace(/-CLEARANCE$/i, "") : "";
    const bizCareOrColl = isBizCareOrCollectionListing(
      product.name,
      product.slug ?? null,
      product.category ?? null,
    );
    if (bizCareOrColl) {
      if (BIZ_COLLECTION_GROUP_METADATA_STYLE_BASES.has(styleBase)) {
        restricted = restricted.filter((c) => !isBizCollectionGroupMetadataColourChip(c));
      }
      if (BIZ_COLLECTION_DETAIL_METADATA_STYLE_BASES.has(styleBase)) {
        restricted = restricted.filter((c) => !isBizCollectionDetailMetadataColourChip(c));
      }
      if (styleBase === "CID940U") {
        restricted = restricted.filter((c) => !isBizCareCid940uExcludedColourChip(c));
      }
    }
    if (
      styleBase === "WP6008" &&
      isBizCollectionListing(product.name, product.slug ?? null, product.category ?? null)
    ) {
      const esc = styleBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`^\\s*${esc}\\s*\\/\\s*`, "i");
      restricted = restricted.map((c) => {
        const t = String(c).replace(re, "").trim();
        return t.length > 0 ? t : String(c);
      });
    }
    if (
      isStorefrontYesChefCh234mPdp(product.name, {
        slug: product.slug ?? null,
        category: product.category ?? null,
        description: product.description ?? null,
        supplier_name: product.supplierName ?? null,
      })
    ) {
      restricted = restricted.filter((c) => !isYesChefCh234mExcludedColourChip(c));
    }
  }
  if (isBizCollectionP29012Listing(product)) {
    return applyBizCollectionP29012ColorDisplayRules(restricted);
  }
  const supLc = (product.supplierName ?? "").trim().toLowerCase();
  if (
    (supLc === "aussie pacific" || slugLower.startsWith("ap-") || /\baussie\s+pacific\b/i.test(product.supplierName ?? "")) &&
    restricted.length >= 2
  ) {
    restricted = [...restricted].sort((a, b) => String(a).localeCompare(String(b)));
  }
  if (isStorefrontAp2211Slug(product.slug ?? null)) {
    restricted = filterAp2211ColorOptions(restricted);
  }
  if (isStorefrontAp3309Slug(product.slug ?? null)) {
    restricted = filterAp3309ColorOptions(restricted);
  }
  return restricted;
}

function parseCartServiceFlags(serviceType: string): { emb: boolean; prn: boolean } {
  const s = serviceType.trim();
  if (s === "Plain" || s.length === 0) {
    return { emb: false, prn: false };
  }
  return {
    emb: s.includes("Embroidery"),
    prn: s.includes("Printing"),
  };
}

/** Full Back (FB) and Full Chest (FC): printing only — no embroidery option on the PDP. */
function isEmbroideryOfferedForPlacement(diagramAbbr: string): boolean {
  const a = diagramAbbr.trim().toUpperCase();
  return a !== "FB" && a !== "FC";
}

function placementAssignmentsFromCartLines(
  placementLines: string[],
  options: { id: string; label: string; diagramAbbr: string }[],
): Record<string, DecoratedServiceType | null> {
  const out: Record<string, DecoratedServiceType | null> = {};
  for (const raw of placementLines) {
    const m = raw.match(/^(Embroidery|Printing):\s*(.+)$/);
    if (!m) {
      continue;
    }
    const svc = m[1] as DecoratedServiceType;
    const label = m[2].trim();
    const opt = options.find((o) => o.label === label);
    if (opt && (svc === "Embroidery" || svc === "Printing")) {
      if (svc === "Embroidery" && !isEmbroideryOfferedForPlacement(opt.diagramAbbr)) {
        continue;
      }
      out[opt.id] = svc;
    }
  }
  return out;
}

const servicePricing: Record<ServiceType, number> = {
  Plain: 0,
  Embroidery: 0,
  Printing: 0,
};

/** Embroidery add-ons by placement (supplier-style codes: LC, RC, CC, BU, BM, FB, FC, LS, RS). */
const defaultEmbroideryPlacementPricing: Record<string, number> = {
  "left chest": 9.95,
  "left-hand chest": 9.95,
  "right chest": 7.95,
  "center chest": 24.95,
  "full back": 18,
  "front full": 18,
  "front bottom": 18,
  "full chest": 18,
  "front collar": 18,
  "back upper": 7.95,
  "back middle": 24.95,
  "left sleeve": 8.95,
  "right sleeve": 8.95,
};

/** Per-placement add-on when Printing is chosen (LC, RC, CC, BU, BM, FB, FC, LS, RS). */
const defaultPrintingPlacementPricing: Record<string, number> = {
  "left chest": 8.95,
  "left-hand chest": 8.95,
  "right chest": 6.95,
  "center chest": 14.95,
  "full back": 17.95,
  "front full": 17.95,
  "front bottom": 18,
  "full chest": 17.95,
  "front collar": 18,
  "back upper": 7.95,
  "back middle": 14.95,
  "left sleeve": 7.95,
  "right sleeve": 7.95,
};

const PLACEMENT_FALLBACK_EMBROIDERY = 2.0;
const PLACEMENT_FALLBACK_PRINTING = 1.5;

function toCurrency(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function toCurrencyExact(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function cents(n: number) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

/** Matches supplier filenames like `…_Product_MidBlue_01.jpg` (see sync-supplier-catalog). */
function humanizeColorInFilename(raw: string) {
  const jb = jbColorNameFromCode(raw);
  if (jb) {
    return jb;
  }
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

function jbColorNameFromCode(raw: string): string | null {
  const key = String(raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (!key) return null;

  // Common JB colour codes that appear in filenames like `1JT_BX_01_...` or `S3FH_B_01_...`.
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

function bisleyColorNameFromCode(raw: string): string | null {
  const key = String(raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (!key) return null;
  const map: Record<string, string> = {
    BBLK: "Black",
    BLACK: "Black",
    BF51: "Yellow",
    BF61: "Orange",
    BCDR: "Khaki",
    BPCT: "Navy",
    BSAN: "Sand",
    BSAND: "Sand",
    BVCB: "Royal",
    BGRG: "Bottle",
    BVEO: "Orange",
    BPLB: "Sky",
    BWHT: "White",
    BDKN: "Midnight",
    BPEY: "Sand",
    BOLV: "Olive",
    SKY: "Sky",
    WHITE: "White",
    MIDNIGHT: "Midnight",
    SAND: "Sand",
    BCCG: "Charcoal",
    BSTN: "Stone",
    BCRU: "Blue",
    BLWR: "Green",
  };
  return map[key] ?? null;
}

function compactColorKey(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Loose label match vs DB / API (spacing, unicode); keep in sync with `apColourNormKey` in sync-aussie-pacific-api.mjs. */
function pdpColourNormKey(input: string): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ");
}

function indexOfColorOption(colOpts: readonly string[], picked: string): number {
  const trimmed = picked.trim();
  let idx = colOpts.indexOf(trimmed);
  if (idx >= 0) return idx;
  const wantNorm = pdpColourNormKey(trimmed);
  idx = colOpts.findIndex((c) => pdpColourNormKey(c) === wantNorm);
  if (idx >= 0) return idx;
  const want = compactColorKey(trimmed);
  return colOpts.findIndex((c) => compactColorKey(c) === want);
}

/** Same token list as `deriveColorOptionsFromImageUrls` in `app/products/[slug]/page.tsx`. */
const SIMPLE_COLOR_WORDS_COMBO = new Set(
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

function extractColorTokenFromGalleryFilename(fileNoQuery: string): string | null {
  const shot = fileNoQuery.match(/_(?:Product|Talent)_([A-Za-z0-9_-]+)_/i);
  if (shot?.[1]) {
    return shot[1];
  }
  const generic = fileNoQuery.match(/^[A-Za-z0-9]+_([A-Za-z0-9_-]+)_(?:\d{1,3})\.[A-Za-z0-9]+$/i);
  if (generic?.[1]) {
    return generic[1];
  }
  const tail = fileNoQuery.match(/_([A-Za-z0-9_-]+)_(?:\d{1,3})\.[A-Za-z0-9]+$/i);
  if (tail?.[1]) {
    return tail[1];
  }
  return null;
}

/** `humanizeColorToken` on the server — no JB single-letter remap (combo tokens stay intact). */
function humanizeSupplierFilenameToken(raw: string) {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

/**
 * One catalogue label string from a supplier product-shot filename (Biz / Syzmik `_Product_` / `_Talent_`).
 * Mirrors `deriveColorOptionsFromImageUrls` for a single file (Talent included so thumbnail clicks still map).
 */
function supplierDisplayColorLabelFromFileNoQuery(fileNoQuery: string): string | null {
  const token = extractColorTokenFromGalleryFilename(fileNoQuery);
  if (!token) {
    // Blue Whale supplier-media images often use space-separated filenames like:
    // `V85 FLUORO YELLOW BK.jpg`, `C81 orange navy.jpg`, `C81 YELLOW NAVY VENT.jpg`
    const m = fileNoQuery.match(/^([A-Za-z0-9]+)\s+(.+)\.(jpg|jpeg|png|webp)$/i);
    if (m?.[1] && m?.[2]) {
      const rest = m[2]
        .replace(/\b(back|bk|vent)\b/gi, " ")
        .replace(/\bunder\s*arm\b/gi, " ")
        .replace(/\bmodel\b/gi, " ")
        .replace(/\b0?\d+\b/g, " ")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!rest) return null;
      const wordsRaw = rest
        .split(/\s+/)
        .map((w) => w.trim())
        .filter(Boolean);
      const words = wordsRaw
        .filter((w) => !/^and$/i.test(w))
        .filter((w) => !/^safety$/i.test(w))
        .filter((w) => w.length > 0)
        .filter((w) => SIMPLE_COLOR_WORDS_COMBO.has(w.toLowerCase()) || w.toLowerCase() === "fluoro" || w.toLowerCase() === "navy");
      const unique = words
        .map((w) => w.toLowerCase())
        .filter((w, i, arr) => arr.indexOf(w) === i);
      if (unique.length >= 2) {
        return unique.map(titleCaseWord).join(" / ");
      }
      if (unique.length === 1) {
        return titleCaseWord(unique[0] ?? "");
      }
      // Fallback: keep something readable so code maps (e.g. FYN) can still normalize later.
      return wordsRaw.map(titleCaseWord).join(" ");
    }
    return null;
  }
  if (/[_-]/.test(token)) {
    const parts = token
      .split(/[_-]+/g)
      .map((p) => humanizeSupplierFilenameToken(p))
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return parts.map(titleCaseWord).join(" / ");
    }
  }
  const human = humanizeSupplierFilenameToken(token);
  if (!human) {
    return null;
  }
  const words = human
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length >= 2 && words.every((w) => SIMPLE_COLOR_WORDS_COMBO.has(w))) {
    return formatComboColorFromWords(words);
  }
  return human;
}

/** Normalize supplier quirks so `Black / P Grey` matches storefront `Black / Grey`. */
function normalizeSupplierColorSynonyms(label: string): string {
  let s = label.replace(/\s+/g, " ").trim();
  // Blue Whale / generic: ignore marketing qualifiers when matching filenames.
  s = s.replace(/\bSafety\b/gi, "").replace(/\bFluoro\b/gi, "").replace(/\s+/g, " ").trim();
  s = s.replace(/\bnavy\s*blue\b/gi, "navy");
  // Some supplier-media filenames split "navy blue" into separate tokens; treat lone "blue" as part of navy.
  if (/\bnavy\b/i.test(s)) {
    s = s.replace(/\bblue\b/gi, "").replace(/\s+/g, " ").trim();
  }
  s = s.replace(/\byello\b/gi, "yellow");
  // Blue Whale image tokens like `FYN` / `FON` appear in filenames; map them to the labelled combos.
  s = s.replace(/\bfyn\b/gi, "yellow navy");
  s = s.replace(/\bfon\b/gi, "orange navy");
  s = s.replace(/\bfybt\b/gi, "yellow bottle green");
  // Bisley Apex / taped combos sometimes use TT01/TT02 tokens in filenames.
  // Keep the `/` so `colorMatchKey("Yellow/Navy")` matches too (it strips `/ Navy` combos).
  s = s.replace(/\btt01\b/gi, "yellow / navy");
  s = s.replace(/\btt02\b/gi, "orange / navy");
  // Some Bisley media uses TT04 for the Yellow/Navy combo (e.g. BJ6730T).
  s = s.replace(/\btt04\b/gi, "yellow / navy");
  // Some Bisley media uses TT05 for the Orange/Navy combo (e.g. BJ6934T).
  s = s.replace(/\btt05\b/gi, "orange / navy");
  // Some Bisley media uses TT21 for the Pink/Navy combo (e.g. BKL6975).
  s = s.replace(/\btt21\b/gi, "pink / navy");
  // Blue Whale: some SKUs have mis-linked supplier-media images from nearby styles; normalize those too.
  s = s.replace(/\bc82\b/gi, "");
  s = s.replace(/\bc83\b/gi, "");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\bBlack\s+P\s+Grey\b/gi, "Black / Grey");
  if (s.includes("/")) {
    const parts = s
      .split(/\s*\/\s*/)
      .map((seg) => seg.trim())
      .filter(Boolean)
      .map((seg) => seg.replace(/\bnavy\b/gi, "navy").trim());
    const kept = parts
      .filter((p) => compactColorKey(p) !== "navy")
      .map((p) => {
        if (/^p\s*grey$/i.test(p) || compactColorKey(p) === "pgrey") {
          return "Grey";
        }
        return p;
      });
    return (kept.length > 0 ? kept : parts).join(" / ");
  }
  return s;
}

function colorMatchKey(label: string): string {
  return compactColorKey(normalizeSupplierColorSynonyms(label));
}

/** Single URL vs colour — same rules as gallery hero pick (for reverse lookup from thumbnails). */
function scoreGalleryUrlForColor(color: string, url: string): number {
  const trimmed = color.trim();
  if (!trimmed) {
    return 0;
  }
  const colorCompact = compactColorKey(trimmed);
  const colorLower = trimmed.toLowerCase();
  const colorWords = colorLower.split(/\s+/).filter((w) => w.length > 1);
  const isComboLabel = trimmed.includes("/");

  const file = decodeURIComponent(url.split("/").pop() ?? url);
  const pathLower = url.toLowerCase();
  let score = 0;

  // Blue Whale: some image filenames use supplier short codes (e.g. FYN/FON) instead of colour words.
  // Map those codes directly to Yellow/Orange so chips pick the correct hero image.
  if (/\bfyn\b/i.test(file)) {
    if (colorLower.includes("yellow")) score += 140;
    if (colorLower.includes("orange")) score -= 35;
  }
  if (/\bfon\b/i.test(file)) {
    if (colorLower.includes("orange")) score += 140;
    if (colorLower.includes("yellow")) score -= 35;
  }
  if (/\bfybt\b/i.test(file)) {
    if (colorLower.includes("bottle") || colorLower.includes("green")) score += 140;
    if (colorLower.includes("navy")) score -= 25;
  }

  const shotMatch = file.match(/_(?:Product|Talent)_([A-Za-z0-9_-]+)_/i);
  if (shotMatch) {
    const fromFile = humanizeColorInFilename(shotMatch[1]);
    const fileCompact = compactColorKey(fromFile);
    if (fromFile.toLowerCase() === colorLower) {
      score += 120;
    } else if (fileCompact === colorCompact) {
      score += 120;
    } else if (
      !isComboLabel &&
      (fileCompact.includes(colorCompact) || colorCompact.includes(fileCompact))
    ) {
      score += 70;
    } else if (isComboLabel) {
      const parts = trimmed
        .split(/\s*\/\s*/)
        .map((p) => compactColorKey(normalizeSupplierColorSynonyms(p.trim())))
        .filter((p) => p.length > 1);
      let matched = 0;
      for (const p of parts) {
        if (fileCompact.includes(p)) {
          matched++;
        }
      }
      if (parts.length >= 2 && matched === parts.length) {
        score += 105;
      } else if (matched > 0) {
        score += matched * 22;
      }
    } else {
      for (const w of colorWords) {
        if (w.length > 2 && fileCompact.includes(w)) {
          score += 25;
        }
      }
    }
    if (/Product/i.test(file)) {
      score += 45;
    } else if (/Talent/i.test(file)) {
      score -= 35;
    }
  }

  // JB's Wear filenames often use compact colour codes like `_BX_`, `_NX_`, or `_B_`.
  // Try to extract that code and match against the colour label.
  const jbCodeMatch = file.match(/^[A-Za-z0-9]+[_-]([A-Za-z0-9]{1,3})X?[_-]/);
  if (jbCodeMatch?.[1]) {
    const mapped = jbColorNameFromCode(jbCodeMatch[1]);
    if (mapped) {
      const mappedCompact = compactColorKey(mapped);
      if (mappedCompact && colorCompact === mappedCompact) {
        score += 110;
      } else if (mappedCompact && (mappedCompact.includes(colorCompact) || colorCompact.includes(mappedCompact))) {
        score += 85;
      } else {
        const mappedWords = mapped
          .toLowerCase()
          .split(/\s+/)
          .map((w) => w.trim())
          .filter(Boolean);
        for (const w of mappedWords) {
          if (w.length > 2 && colorCompact.includes(w)) {
            score += 22;
          }
        }
      }
      if (/[_-]0?1\./i.test(file)) {
        score += 6;
      }
    }
  }

  // Bisley: some catalogs use short codes in filenames (e.g. BBEAN55_BBLK_…, BBEAN55_BF51_…).
  const bisleyCodeMatch = file.match(/^[A-Za-z0-9]+[_-]([A-Za-z0-9]{3,6})[_-]/);
  if (bisleyCodeMatch?.[1]) {
    const mapped = bisleyColorNameFromCode(bisleyCodeMatch[1]);
    if (mapped) {
      const mappedCompact = compactColorKey(mapped);
      if (mappedCompact && colorCompact === mappedCompact) {
        score += 120;
      } else if (mappedCompact && (mappedCompact.includes(colorCompact) || colorCompact.includes(mappedCompact))) {
        score += 90;
      }
    }
  }

  if (!shotMatch) {
    for (const w of colorWords) {
      if (pathLower.includes(w)) {
        score += 15;
      }
    }
    if (colorCompact.length >= 3 && compactColorKey(file).includes(colorCompact)) {
      score += 40;
    }
  }

  if (/[_-]0?1\.(jpg|jpeg|png|webp)/i.test(file)) {
    score += 4;
  }

  return score;
}

function galleryFilenameTail(url: string): string {
  const tail = url.split("/").pop() ?? url;
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

/**
 * Slug `jb-s3fsz` → `S3FSZ` for filenames like `S3FSZBX_01.jpg` (style + colour run together).
 * Skips long marketing slugs (e.g. `jb-premium-work-polo`) so we do not strip the wrong prefix.
 */
function jbStyleCodeUpperFromSlug(slug: string | null | undefined): string | null {
  const s = (slug ?? "").trim().toLowerCase();
  if (!s.startsWith("jb-")) {
    return null;
  }
  const rest = s.slice(3).replace(/-/g, "");
  if (!rest || rest.length < 2 || rest.length > 12 || !/^[a-z0-9]+$/.test(rest)) {
    return null;
  }
  return rest.toUpperCase();
}

/** Same rules as `deriveJbColorsFromImageUrls` in `app/products/[slug]/page.tsx`, plus compact `STYLE+CODE_` names. */
function jbExtractColorCodeFromJbFilename(fileNoQuery: string, styleUpper: string | null): string | null {
  const m = fileNoQuery.match(/^[A-Za-z0-9]+[_-]([A-Za-z0-9]{1,3})X?[_-]/);
  if (m?.[1]) {
    return String(m[1]);
  }
  const base = fileNoQuery.replace(/\.[^.]+$/i, "");
  if (styleUpper && base.length > styleUpper.length) {
    const up = base.toUpperCase();
    if (up.startsWith(styleUpper)) {
      const after = base.slice(styleUpper.length);
      const m2 = after.match(/^([A-Za-z0-9]{1,3})X?[_-]/);
      if (m2?.[1]) {
        return String(m2[1]);
      }
    }
  }
  return null;
}

function jbMappedDisplayColorFromImageUrl(url: string, styleUpper: string | null): string | null {
  const tail = galleryFilenameTail(url);
  const fileNoQuery = (tail.split("?")[0] ?? "").trim();
  if (!fileNoQuery) {
    return null;
  }
  const code = jbExtractColorCodeFromJbFilename(fileNoQuery, styleUpper);
  if (!code) {
    return null;
  }
  return jbColorNameFromCode(code);
}

/** True when filenames look like supplier product shots we can match to a colour label. */
function galleryHasStructuredProductShots(urls: readonly string[]): boolean {
  for (const u of urls) {
    if (typeof u !== "string" || !u.trim()) continue;
    const lower = u.toLowerCase();
    const isSupplierMedia = lower.includes("/api/supplier-media/");
    // Remote opaque hosts only: same-origin `/api/supplier-media/…` still carries real filenames (Biz / JB)
    // after `resolveStorefrontImageUrlList` — do not skip those or structured matching breaks site-wide.
    // Aussie Pacific opaque keys on S3/CloudFront can satisfy the loose `*_…_01.jpg` heuristic below.
    if (lower.includes("amazonaws.com") || lower.includes("cloudfront.net")) {
      continue;
    }
    const fileNoQuery = (galleryFilenameTail(u).split("?")[0] ?? "").trim();
    if (/_(?:Product|Talent)_/i.test(fileNoQuery)) {
      return true;
    }
    // JB-style `SKU_Color_01.jpg` — but NOT opaque S3 keys like `1k_hash1_hash2_1.jpg` (many `_` segments).
    if (/^[A-Za-z0-9]+_[A-Za-z0-9_-]+_(?:\d{1,3})\.[A-Za-z0-9]+$/i.test(fileNoQuery)) {
      const underscoreCount = (fileNoQuery.match(/_/g) ?? []).length;
      if (underscoreCount <= 2) {
        return true;
      }
    }
    // Blue Whale (and some supplier-media imports): filenames use spaces, e.g. `V85 FLUORO YELLOW BK.jpg`.
    if (
      isSupplierMedia &&
      /^[A-Za-z0-9]+\s+[A-Za-z0-9][A-Za-z0-9\s-]*\.(jpg|jpeg|png|webp)$/i.test(fileNoQuery)
    ) {
      return true;
    }
  }
  return false;
}

/** Style `2310` PDP: hero shots sit at gallery indices 2 / 4 / 6 (1-based 3 / 5 / 7), not proportional buckets. */
function isAp2310ProductSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  if (/(?:^|-)ap-2310(?:$|-)/.test(s)) return true;
  if (s.startsWith("ap-") && /(?:^|[-_])2310(?:$|[-_])/.test(s)) return true;
  return false;
}

function isAussiePacificListingContext(slug?: string | null, supplierName?: string | null): boolean {
  const sup = String(supplierName ?? "").trim().toLowerCase();
  const slugLower = String(slug ?? "").trim().toLowerCase();
  return (
    sup === "aussie pacific" ||
    slugLower.startsWith("ap-") ||
    /\baussie\s+pacific\b/i.test(supplierName ?? "")
  );
}

/**
 * PDP shows `Aussie Pacific / 2310` from `displayProductCode`, but the URL slug may not contain `ap-2310`
 * (manual rows, redirects, or legacy imports). Match style code on the payload, not only the slug.
 */
function isAp2310StorefrontProduct(
  p: Pick<ProductDetailData, "slug" | "supplierName" | "displayProductCode" | "name" | "description">,
): boolean {
  if (isAp2310ProductSlug(p.slug)) return true;
  if (!isAussiePacificListingContext(p.slug, p.supplierName)) return false;
  const code = String(p.displayProductCode ?? "")
    .trim()
    .replace(/^W(?=[0-9])/i, "")
    .trim();
  if (/^2310$/i.test(code)) return true;
  const head = String(p.name ?? "").trim().split(/\r?\n/)[0]?.trim() ?? "";
  if (/\s-\s*W?2310\s*$/i.test(head)) return true;
  if (/^\s*style\s*code\s*:\s*W?2310\b/im.test(String(p.description ?? ""))) return true;
  return false;
}

/**
 * Pick the hero image for a colour from gallery URLs (`_Product_` / `_Talent_` tokens).
 * Prefers flat `_Product_` shots so the colour swatch matches the garment, not on-model `_Talent_` marketing.
 * JB's Wear: when `import-jbswear-xlsx` tagged the gallery with `#jbpc=N`, use index order (see `parseJbGalleryUrls`).
 */
function pickPrimaryImageForColor(color: string, urls: string[], opts?: GalleryColorPickOpts): string {
  const list = urls.map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0);
  if (!list.length) {
    return "";
  }
  const trimmed = color.trim();
  if (!trimmed) {
    return list[0]!;
  }

  const colOpts = opts?.colorOptions;
  // AP 2310: three combo colours — intended flat-lay heroes are at 3rd / 5th / 7th slots in the import gallery.
  // Map by chip order (Aussie Pacific chips are sorted alphabetically: Black/Green, Black/Orange, Black/Red).
  if (opts?.isAp2310Listing && colOpts && colOpts.length === 3 && list.length >= 7) {
    const ci = indexOfColorOption(colOpts, trimmed);
    if (ci >= 0 && ci < 3) {
      const heroes: readonly number[] = [2, 4, 6];
      const hi = heroes[ci]!;
      if (hi < list.length) {
        return list[hi]!;
      }
    }
  }

  const pc = opts?.jbPrefixCount ?? 0;
  /** Aussie Pacific: never use filename heuristics — always gallery index × stride vs colour chips. */
  if (opts?.forceOpaqueColorIndex) {
    const slugLc = (opts.productSlug ?? "").trim().toLowerCase();
    if (slugLc === "ap-1111" && colOpts && list.length > 2) {
      const blackIdx = indexOfColorOption(colOpts, "Black");
      const selIdx = indexOfColorOption(colOpts, trimmed);
      if (blackIdx >= 0 && selIdx === blackIdx) {
        return list[2]!;
      }
    }
    const sync = galleryIndexSyncHeroForColor(trimmed, list, colOpts, true, opts.opaqueProportionalBuckets ?? false);
    if (sync) {
      return sync;
    }
    return list[0]!;
  }
  if (
    opts?.isJbWear &&
    pc > 0 &&
    colOpts &&
    list.length >= pc
  ) {
    const i = indexOfColorOption(colOpts, String(color));
    if (i >= 0 && i < pc) {
      return list[i] ?? list[0]!;
    }
  }

  if (opts?.isJbWear && colOpts && pc === 0) {
    const style = opts.jbStyleCodeUpper ?? null;
    const want = compactColorKey(trimmed);
    for (const u of list) {
      const mapped = jbMappedDisplayColorFromImageUrl(u, style);
      if (mapped && compactColorKey(mapped) === want) {
        return u;
      }
    }
    if (list.length === colOpts.length) {
      const i = indexOfColorOption(colOpts, trimmed);
      if (i >= 0 && i < list.length) {
        return list[i] ?? list[0]!;
      }
    }
  }

  if (!opts?.isJbWear && galleryHasStructuredProductShots(list)) {
    const wantKey = colorMatchKey(trimmed);
    if (wantKey.length >= 3) {
      const pickStructuredMatch = (productFlatLayOnly: boolean) => {
        for (const u of list) {
          const fn = (galleryFilenameTail(u).split("?")[0] ?? "").trim();
          // Match `sync-supplier-catalog.mjs`: flat lays are `_Product_` and not on-model `Talent` shots.
          if (productFlatLayOnly && (!/_Product_/i.test(fn) || /Talent/i.test(fn))) {
            continue;
          }
          const der = supplierDisplayColorLabelFromFileNoQuery(fn);
          if (der && colorMatchKey(der) === wantKey) {
            return u;
          }
        }
        return null;
      };
      const flatLay = pickStructuredMatch(true);
      if (flatLay) {
        return flatLay;
      }
      const anyShot = pickStructuredMatch(false);
      if (anyShot) {
        return anyShot;
      }
    }
  }

  // Opaque CDN keys (e.g. Aussie Pacific): hero follows colour chip index when import order matches `colorOptions`.
  if (!galleryHasStructuredProductShots(list)) {
    const sync = galleryIndexSyncHeroForColor(trimmed, list, colOpts, false);
    if (sync) {
      return sync;
    }
    return list[0]!;
  }

  const scored = list.map((url, idx) => ({
    url,
    idx,
    score: scoreGalleryUrlForColor(trimmed, url),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.idx - b.idx;
  });

  const winner = scored[0]!;
  const firstScore = scoreGalleryUrlForColor(trimmed, list[0]!);

  if (winner.score <= 0) {
    return list[0]!;
  }
  if (winner.idx === 0) {
    return list[0]!;
  }
  // Only move off the first image for a decisive filename match or a large score gap.
  if (winner.score >= 120) {
    return winner.url;
  }
  if (winner.score > firstScore + 45) {
    return winner.url;
  }
  return list[0]!;
}

/**
 * When URLs are opaque, heuristics cannot map an image to a colour — but many catalogues still list
 * gallery images in the same left-to-right order as the storefront colour chips.
 */
function inferColorFromGalleryIndexOrder(
  imageUrl: string,
  colors: readonly string[],
  galleryUrls: readonly string[],
): string | null {
  if (colors.length <= 1 || galleryUrls.length <= 1) {
    return null;
  }
  const idx = galleryUrls.indexOf(imageUrl);
  if (idx < 0) {
    return null;
  }
  if (galleryUrls.length === colors.length) {
    return colors[idx] ?? null;
  }
  if (galleryUrls.length > colors.length && idx < colors.length) {
    return colors[idx] ?? null;
  }
  const k = Math.min(colors.length - 1, Math.max(0, Math.floor((idx * colors.length) / galleryUrls.length)));
  return colors[k] ?? null;
}

/**
 * How many consecutive gallery images belong to each colour (1 = one hero per chip, 2 = front+back, …).
 * Requires `galleryLength` divisible by `colorCount` and at least one image per colour.
 */
function galleryStrideImagesPerColor(colorCount: number, galleryLength: number): number {
  if (colorCount <= 1 || galleryLength <= 1 || galleryLength < colorCount) {
    return 1;
  }
  if (galleryLength % colorCount !== 0) {
    return 1;
  }
  return Math.floor(galleryLength / colorCount);
}

/** Hero row index for colour `colorIdx` when splitting `galleryLength` images across `colorCount` buckets (Aussie Pacific). */
function opaqueHeroImageIndexForColor(colorIdx: number, colorCount: number, galleryLength: number): number {
  if (colorCount <= 1 || galleryLength <= 1) {
    return 0;
  }
  const i = Math.min(colorCount - 1, Math.max(0, colorIdx));
  return Math.min(galleryLength - 1, Math.floor((i * galleryLength) / colorCount));
}

/** Colour bucket index for a gallery image index (inverse of `opaqueHeroImageIndexForColor`). */
function opaqueColorIndexForGalleryImage(imageIdx: number, colorCount: number, galleryLength: number): number {
  if (colorCount <= 1 || galleryLength <= 1) {
    return 0;
  }
  const idx = Math.min(galleryLength - 1, Math.max(0, imageIdx));
  return Math.min(colorCount - 1, Math.floor((idx * colorCount) / galleryLength));
}

/**
 * Signed / opaque gallery URLs (e.g. Aussie Pacific S3 keys): filenames do not carry colour tokens, but the
 * import order usually matches `available_colors` / `colorOptions` left-to-right with one hero per colour.
 */
function galleryImageIndexSyncColor(
  imageUrl: string,
  colors: readonly string[],
  galleryUrls: readonly string[],
  forceOpaque = false,
  proportionalBuckets = false,
): string | null {
  if (colors.length <= 1 || galleryUrls.length <= 1) {
    return null;
  }
  if (galleryHasStructuredProductShots(galleryUrls) && !forceOpaque) {
    return null;
  }
  const idx = galleryUrls.indexOf(imageUrl);
  if (idx < 0) {
    return null;
  }
  if (proportionalBuckets && forceOpaque) {
    const ci = opaqueColorIndexForGalleryImage(idx, colors.length, galleryUrls.length);
    if (ci >= 0 && ci < colors.length) {
      return colors[ci] ?? null;
    }
    return null;
  }
  const stride = galleryStrideImagesPerColor(colors.length, galleryUrls.length);
  const ci = Math.floor(idx / stride);
  if (ci >= 0 && ci < colors.length) {
    return colors[ci] ?? null;
  }
  return null;
}

/** Colour chip → hero URL when gallery order matches `colorOptions` (opaque URLs). */
function galleryIndexSyncHeroForColor(
  color: string,
  list: readonly string[],
  colOpts: readonly string[] | undefined,
  forceOpaque = false,
  proportionalBuckets = false,
): string | null {
  const trimmed = color.trim();
  if (!trimmed || !colOpts || colOpts.length <= 1 || list.length <= 1) {
    return null;
  }
  if (galleryHasStructuredProductShots(list) && !forceOpaque) {
    return null;
  }
  const idx = indexOfColorOption(colOpts, trimmed);
  if (idx < 0) {
    return null;
  }
  if (proportionalBuckets && forceOpaque) {
    const base = opaqueHeroImageIndexForColor(idx, colOpts.length, list.length);
    if (base >= 0 && base < list.length) {
      return list[base] ?? null;
    }
    return null;
  }
  const stride = galleryStrideImagesPerColor(colOpts.length, list.length);
  const base = idx * stride;
  if (base >= 0 && base < list.length) {
    return list[base] ?? null;
  }
  return null;
}

/** Score how well a storefront colour label matches a supplier filename colour token. */
function scoreColorLabelAgainstFileToken(colorLabel: string, tokenRaw: string): number {
  const fromFile = humanizeColorInFilename(tokenRaw);
  const fileCompact = compactColorKey(fromFile);
  const labelCompact = compactColorKey(colorLabel);
  const isCombo = colorLabel.includes("/");
  if (!fileCompact || !labelCompact) {
    return 0;
  }
  if (labelCompact === fileCompact) {
    return 100;
  }
  if (colorMatchKey(colorLabel) === colorMatchKey(fromFile)) {
    return 98;
  }
  if (!isCombo && (fileCompact.includes(labelCompact) || labelCompact.includes(fileCompact))) {
    return 80;
  }
  if (isCombo) {
    const parts = colorLabel
      .split(/\s*\/\s*/)
      .map((p) => compactColorKey(normalizeSupplierColorSynonyms(p.trim())))
      .filter((p) => p.length > 1);
    let matched = 0;
    for (const p of parts) {
      if (fileCompact.includes(p)) {
        matched++;
      }
    }
    if (parts.length >= 2 && matched === parts.length) {
      return 90;
    }
    if (matched > 0) {
      return matched * 20;
    }
    return 0;
  }
  let s = 0;
  const labelWords = colorLabel
    .toLowerCase()
    .split(/[\s/]+/)
    .map((w) => w.replace(/[^a-z0-9]+/g, ""))
    .filter((w) => w.length > 1);
  for (const w of labelWords) {
    if (fileCompact.includes(w)) {
      s += 35;
    }
  }
  const fileWords = fromFile
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]+/g, ""))
    .filter((w) => w.length > 1);
  for (const w of fileWords) {
    if (labelCompact.includes(w)) {
      s += 30;
    }
  }
  return s;
}

/**
 * Which catalogue colour best matches this gallery URL (thumbnail / hero → 1. Colour).
 * Uses URL scoring, then canonical primary URL per colour, then raw filename token vs labels.
 */
function inferBestColorForGalleryImage(
  imageUrl: string,
  colors: readonly string[],
  galleryUrls: readonly string[],
  pickOpts?: GalleryColorPickOpts,
): string | null {
  if (colors.length === 0) {
    return null;
  }
  if (colors.length === 1) {
    return colors[0];
  }

  const slugLcAp = (pickOpts?.productSlug ?? "").trim().toLowerCase();
  if (slugLcAp === "ap-1111" && galleryUrls.length > 2) {
    const thumbIdx = galleryUrls.indexOf(imageUrl);
    if (thumbIdx === 2) {
      const bi = indexOfColorOption(colors, "Black");
      if (bi >= 0) {
        return colors[bi] ?? null;
      }
    }
  }
  if (pickOpts?.isAp2310Listing && colors.length === 3) {
    const thumbIdx = galleryUrls.indexOf(imageUrl);
    const chipIdx =
      thumbIdx === 2 ? 0 : thumbIdx === 4 ? 1 : thumbIdx === 6 || thumbIdx === 7 ? 2 : -1;
    if (chipIdx >= 0) {
      return colors[chipIdx] ?? null;
    }
  }

  const pc = pickOpts?.jbPrefixCount ?? 0;
  if (
    pickOpts?.isJbWear &&
    pc > 0 &&
    galleryUrls.length >= pc
  ) {
    const idx = galleryUrls.indexOf(imageUrl);
    if (idx >= 0 && idx < pc) {
      return colors[idx] ?? null;
    }
  }

  if (pickOpts?.isJbWear) {
    const style = pickOpts.jbStyleCodeUpper ?? null;
    const mapped = jbMappedDisplayColorFromImageUrl(imageUrl, style);
    if (mapped) {
      if (colors.includes(mapped)) {
        return mapped;
      }
      const hit = colors.find((c) => compactColorKey(c) === compactColorKey(mapped));
      if (hit) {
        return hit;
      }
      const hitNorm = colors.find((c) => pdpColourNormKey(c) === pdpColourNormKey(mapped));
      if (hitNorm) {
        return hitNorm;
      }
    }
    const idx = galleryUrls.indexOf(imageUrl);
    if (idx >= 0) {
      if (galleryUrls.length === colors.length) {
        return colors[idx] ?? null;
      }
      if (galleryUrls.length > colors.length && idx < colors.length) {
        return colors[idx] ?? null;
      }
    }
  }

  const opaqueSyncColor = galleryImageIndexSyncColor(
    imageUrl,
    colors,
    galleryUrls,
    pickOpts?.forceOpaqueColorIndex,
    pickOpts?.opaqueProportionalBuckets ?? false,
  );
  if (opaqueSyncColor != null) {
    return opaqueSyncColor;
  }

  if (!pickOpts?.isJbWear) {
    const fileNoQueryDerived = (galleryFilenameTail(imageUrl).split("?")[0] ?? "").trim();
    const supplierDerived = supplierDisplayColorLabelFromFileNoQuery(fileNoQueryDerived);
    if (supplierDerived) {
      const key = colorMatchKey(supplierDerived);
      if (key.length >= 3) {
        const byKey = colors.find((c) => colorMatchKey(c) === key);
        if (byKey) {
          return byKey;
        }
      }
    }
  }

  let best: { color: string; score: number } | null = null;
  for (const c of colors) {
    const s = scoreGalleryUrlForColor(c, imageUrl);
    if (best == null || s > best.score) {
      best = { color: c, score: s };
    }
  }
  if (best && best.score > 0) {
    return best.color;
  }

  const urls = [...galleryUrls];
  for (const c of colors) {
    if (pickPrimaryImageForColor(c, urls, pickOpts) === imageUrl) {
      return c;
    }
  }

  const fileNoQuery = (galleryFilenameTail(imageUrl).split("?")[0] ?? "").trim();
  const token = extractColorTokenFromGalleryFilename(fileNoQuery);
  if (token) {
    let tokenBest: { color: string; score: number } | null = null;
    for (const c of colors) {
      const s = scoreColorLabelAgainstFileToken(c, token);
      if (tokenBest == null || s > tokenBest.score) {
        tokenBest = { color: c, score: s };
      }
    }
    if (tokenBest && tokenBest.score >= 30) {
      return tokenBest.color;
    }
  }

  return inferColorFromGalleryIndexOrder(imageUrl, colors, galleryUrls);
}

function toShortCode(label: string) {
  const words = label
    .split(/[\s/|]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (!words.length) {
    return "OP";
  }
  return words
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const PLACEHOLDER_GALLERY_IMAGE =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80";

/** PDP thumbnail strip: show this many images per “page” with prev/next. */
const GALLERY_THUMB_PAGE_SIZE = 5;

/** Fragment on first gallery URL from `import-jbswear-xlsx.mjs` when every colour has an XLSX hero image. */
const JB_GALLERY_PREFIX_HASH_RE = /#jbpc=(\d+)$/i;

export type GalleryColorPickOpts = {
  colorOptions?: readonly string[];
  /** From `#jbpc=N` after stripping; N === colorOptions.length means first N images align with colour order. */
  jbPrefixCount?: number;
  isJbWear?: boolean;
  /** Compact style from slug `jb-s3fsz` → `S3FSZ` for `STYLE+CODE_` JB filenames. */
  jbStyleCodeUpper?: string | null;
  /**
   * Aussie Pacific (`ap-` slug / supplier): gallery URLs are opaque — always map chip index × stride to images
   * and skip filename-based “structured” detection that blocks index sync.
   */
  forceOpaqueColorIndex?: boolean;
  /**
   * Aussie Pacific: image count per colour may differ — use proportional buckets instead of requiring
   * `galleryLength % colorCount === 0` (Bisley positional galleries keep uniform stride).
   */
  opaqueProportionalBuckets?: boolean;
  /** For product-specific gallery ↔ chip fixes (e.g. `ap-1111`). */
  productSlug?: string | null;
  /**
   * Aussie Pacific style `2310`: hero URLs are at gallery indices 2 / 4 / 6; set from slug and/or
   * `displayProductCode` because the storefront slug may omit `ap-2310`.
   */
  isAp2310Listing?: boolean;
};

function parseJbGalleryUrls(raw: readonly string[]): { urls: string[]; prefixCount: number } {
  if (!raw.length) {
    return { urls: [], prefixCount: 0 };
  }
  let prefixCount = 0;
  const urls = raw
    .map((u) => {
      const s = typeof u === "string" ? u : "";
      const m = JB_GALLERY_PREFIX_HASH_RE.exec(s);
      if (m) {
        const n = parseInt(m[1] ?? "", 10);
        if (Number.isFinite(n) && n > 0) {
          prefixCount = n;
        }
        return s.slice(0, m.index);
      }
      return s;
    })
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  return { urls, prefixCount };
}

function isJbWearStorefrontProduct(slug: string | null | undefined, supplierName: string | undefined): boolean {
  const s = (slug ?? "").trim().toLowerCase();
  if (s.startsWith("jb-")) {
    return true;
  }
  const sup = (supplierName ?? "").trim().toLowerCase();
  return (
    sup === "jb's wear" ||
    sup === "jbs wear" ||
    sup === "jbswear" ||
    /\bjbs\s*wear\b/i.test(supplierName ?? "")
  );
}

function isSyzmikStorefrontProduct(slug: string | null | undefined, supplierName: string | undefined): boolean {
  const s = (slug ?? "").trim().toLowerCase();
  if (s.includes("syzmik") || s.startsWith("fb-syzmik-")) {
    return true;
  }
  const sup = (supplierName ?? "").trim().toLowerCase();
  return sup === "syzmik";
}

function syzmikFormatDescriptionSemicolonLineBreaks(desc: string): string {
  // Many Syzmik descriptions arrive as `Sentence; Sentence; Sentence` blocks.
  // Render `;` as a paragraph/list line break while preserving the semicolon.
  return desc.replace(/;\s*/g, ";\n");
}

function syzmikFormatDescriptionFeaturesColonAndCommas(desc: string): string {
  const s = String(desc ?? "");
  if (!s.trim()) return s;
  const lines = s.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const m = /^(\s*features\s*):\s*(.*)$/i.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    const label = (m[1] ?? "Features").trim();
    const rest = (m[2] ?? "").trim();
    if (!rest) {
      out.push(`${label}:`);
      continue;
    }
    // `Features: A, B, C` → `Features:\n\t- A\n\t- B\n\t- C`
    const bullets = syzmikFormatFeaturesCommaToTabbedBullets(rest);
    out.push(`${label}:\n${bullets}`);
  }

  return out.join("\n");
}

function syzmikFormatFeaturesCommaToTabbedBullets(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return s;
  // If it already has structured newlines/bullets, keep it as-is.
  if (/\r?\n/.test(s) || /^\s*-\s+/m.test(s)) return s;
  if (!s.includes(",")) return s;
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return s;
  return `\t- ${parts.join("\n\t- ")}`;
}

function galleryForUrls(urls: string[]) {
  return urls.length > 0 ? urls : [PLACEHOLDER_GALLERY_IMAGE];
}

function emptySizeQuantities(sizes: string[]): Record<string, number> {
  return Object.fromEntries(sizes.map((s) => [s, 0]));
}

function emptyColorSizeQuantities(colors: string[], sizes: string[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const c of colors) {
    out[c] = emptySizeQuantities(sizes);
  }
  return out;
}

function readBrowserCookie(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }
  const key = `${name}=`;
  const found = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(key));
  return found ? decodeURIComponent(found.slice(key.length)) : "";
}

function ProductGoogleRatingRow({ info }: { info: ProductGoogleRating }) {
  const link = info.url;
  const isStoreWide = info.scope === "business";
  return (
    <div className="space-y-0.5">
      <p className="product-detail-google-rating text-[1.2rem] font-light leading-snug text-brand-navy/85">
        <span className="font-medium tabular-nums text-brand-orange">{info.rating.toFixed(1)}</span>
        <span className="text-brand-orange" aria-hidden>
          {" "}
          ★
        </span>
        <span className="text-brand-navy/50"> · </span>
        <span className="tabular-nums">{info.userRatingsTotal.toLocaleString("en-US")} reviews</span>
        <span className="text-brand-navy/45"> · </span>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-navy underline decoration-brand-orange/50 underline-offset-2 hover:text-brand-orange"
          >
            Google
          </a>
        ) : (
          <span className="text-brand-navy/50">Google</span>
        )}
      </p>
      {isStoreWide ? (
        <p className="text-[1.02rem] font-light text-brand-navy/55">
          Based on Google reviews for our store (all products share this score).
        </p>
      ) : null}
    </div>
  );
}

function downloadSizeGuideText(
  filenameBase: string,
  bundle: SizeGuideBundle,
  externalLinks: SupplierSizeChartLink[],
) {
  const body = sizeGuideToPlainText(bundle);
  const text = appendSupplierLinksToPlainText(body, externalLinks);
  const safe = filenameBase.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "product";
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `size-guide-${safe}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function SizeGuideDialog({
  open,
  onClose,
  bundle,
  downloadSlug,
  externalLinks,
}: {
  open: boolean;
  onClose: () => void;
  bundle: SizeGuideBundle;
  downloadSlug: string;
  externalLinks: SupplierSizeChartLink[];
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close size guide"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="size-guide-title"
        className="relative z-10 flex max-h-[min(85vh,640px)] w-full max-w-[46.08rem] flex-col overflow-hidden rounded-t-2xl border border-brand-navy/15 bg-white shadow-2xl sm:m-4 sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-brand-navy/10 px-4 py-3 sm:px-5 sm:py-4">
          <h2 id="size-guide-title" className="text-[1.62rem] font-medium text-brand-navy">
            {bundle.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[1.26rem] font-semibold text-brand-navy/70 hover:bg-brand-surface hover:text-brand-navy"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          <p className="whitespace-pre-wrap text-[1.26rem] leading-relaxed text-brand-navy/80">{bundle.intro}</p>
          {externalLinks.length > 0 ? (
            <div className="mt-4 rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-3 py-3 sm:px-4">
              <p className="mb-2 text-[1.08rem] font-medium uppercase tracking-[0.08em] text-brand-navy/65">
                Official supplier size charts
              </p>
              <ul className="space-y-2">
                {externalLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[1.26rem] font-semibold text-brand-navy underline decoration-brand-orange/70 underline-offset-2 hover:text-brand-orange"
                    >
                      {link.label}
                      <span className="ml-1 text-[1.08rem] font-normal text-brand-navy/55">(opens new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-4 space-y-5">
            {bundle.tables.map((t) => (
              <div key={t.caption}>
                <p className="mb-2 text-[1.08rem] font-medium uppercase tracking-[0.08em] text-brand-navy/60">
                  {t.caption}
                </p>
                <div className="overflow-x-auto rounded-xl border border-brand-navy/10">
                  <table className="w-full min-w-[280px] text-left text-[1.26rem] text-brand-navy">
                    <thead>
                      <tr className="border-b border-brand-navy/10 bg-brand-surface/80">
                        {t.headers.map((h) => (
                          <th key={h} className="px-3 py-2 font-light">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map((row, ri) => (
                        <tr key={`${t.caption}-r-${ri}`} className="border-b border-brand-navy/5 last:border-b-0">
                          {row.map((cell, ci) => (
                            <td key={`${t.caption}-r-${ri}-c-${ci}`} className="px-3 py-2 font-light text-brand-navy/85">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          {/* 정확한 사이즈는 공급자 웹사이트 기준 — 문구는 SIZE_GUIDE_SUPPLIER_WEBSITE_FOOTNOTE와 동기화 */}
          <p className="mt-5 text-[1.08rem] leading-relaxed text-red-700">
            * {SIZE_GUIDE_SUPPLIER_WEBSITE_FOOTNOTE}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-brand-navy/10 px-4 py-3 sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={() => downloadSizeGuideText(downloadSlug, bundle, externalLinks)}
            className="rounded-xl bg-brand-orange px-4 py-2.5 text-[1.26rem] font-medium text-brand-navy transition hover:brightness-95"
          >
            Download as .txt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-brand-navy/20 px-4 py-2.5 text-[1.26rem] font-semibold text-brand-navy hover:bg-brand-surface"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroImageLightbox({
  open,
  onClose,
  src,
  alt,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !src) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Full size product image"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close enlarged image"
        onClick={onClose}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-lg bg-white px-3 py-2 text-[1.08rem] font-semibold text-brand-navy shadow-lg hover:bg-brand-surface sm:right-6 sm:top-6"
      >
        Close
      </button>
      <div className="relative z-10 flex max-h-[min(88dvh,92vh)] max-w-[min(96vw,min(100vw-2rem,56rem))] items-center justify-center">
        <img
          src={src}
          alt={alt}
          className="h-auto max-h-[min(88dvh,92vh)] w-auto max-w-full cursor-zoom-out object-contain"
          loading="eager"
          decoding="async"
          onClick={onClose}
        />
      </div>
    </div>
  );
}

/**
 * One description paragraph (`\n\n`-split block): each non-empty line shows a large bullet + tab-like indent,
 * then the text. Lines that start with `- ` in the DB still strip the hyphen and use the same bullet style.
 */
function ProductDescriptionFormattedBlock({ block }: { block: string }) {
  const lines = block.split(/\r?\n/);
  return (
    <div className="space-y-0.5">
      {lines.map((rawLine, i) => {
        const trimmed = rawLine.trim();
        if (!trimmed) {
          return <div key={i} className="h-1 min-h-1 shrink-0" aria-hidden />;
        }
        /** Tab/space-indented `- item` (e.g. Biz Collection Features sub-lines) — smaller dash, no big bullet. */
        const indentedHyphen = /^(\s+)-\s+(.*)$/.exec(rawLine);
        if (indentedHyphen && indentedHyphen[1].length > 0) {
          const text = indentedHyphen[2].trim();
          return (
            <div
              key={i}
              className="flex items-start gap-2 pl-5 sm:gap-3 sm:pl-7"
            >
              <span className="shrink-0 select-none pt-[0.12em] font-medium text-brand-navy/75" aria-hidden>
                -
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap pt-[0.12em] text-brand-navy/75">{text}</span>
            </div>
          );
        }
        const hyphenLead = /^-\s+(.*)$/.exec(trimmed);
        const text = hyphenLead ? hyphenLead[1].trim() : trimmed;
        return (
          <div key={i} className="flex items-start gap-2 sm:gap-3">
            <span
              className="shrink-0 select-none text-[1.42em] font-semibold leading-[1.2] text-brand-navy/90 sm:text-[1.48em]"
              aria-hidden
            >
              •
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap pl-1 pt-[0.12em] sm:pl-2">{text}</span>
          </div>
        );
      })}
    </div>
  );
}

function bizCollectionFormatFabricBullets(block: string): string {
  const out: string[] = [];
  const lines = block.split(/\r?\n/);
  for (const raw of lines) {
    const idx = raw.toLowerCase().indexOf("fabric:");
    if (idx < 0) {
      out.push(raw);
      continue;
    }
    const before = raw.slice(0, idx);
    const after = raw.slice(idx + "fabric:".length);
    const head = `${before}Fabric:`.trimEnd();
    if (head.trim().length > 0) {
      out.push(head);
    } else {
      out.push("Fabric:");
    }

    const semi = after.indexOf(";");
    const fabricPart = (semi >= 0 ? after.slice(0, semi) : after).trim();
    const tailPart = (semi >= 0 ? after.slice(semi + 1) : "").trim();

    const items = fabricPart
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (items.length === 0 && fabricPart.length > 0) {
      out.push(`\t- ${fabricPart}`);
    } else {
      for (const it of items) {
        out.push(`\t- ${it}`);
      }
    }

    if (tailPart.length > 0) {
      out.push(tailPart);
    }
  }
  return out.join("\n");
}

export function PremiumWorkPoloClient({
  product,
  placements,
  serverPdpDescriptionBody: serverPdpDescriptionFromRsc,
}: PremiumWorkPoloClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const colorOptions = useMemo(() => effectivePdpColorOptions(product), [product]);

  const { productName, productCode } = useMemo(
    () =>
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
            colorOptions,
            undefined,
            product.sizeOptions,
          ),
    [
      colorOptions,
      product.description,
      product.displayProductCode,
      product.displayProductName,
      product.name,
      product.sizeOptions,
      product.slug,
      product.supplierName,
    ],
  );
  const pdpProductTitle = useMemo(
    () =>
      bisleyPdpDisplayProductNameWithApexPrefix(
        productName,
        productCode,
        product.supplierName ?? null,
        product.slug ?? null,
        product.name,
      ),
    [product.name, product.slug, product.supplierName, productCode, productName],
  );

  const activeDealPackage = useMemo((): StorefrontSpecialDealPackage | null => {
    const productMeta = {
      slug: product.slug ?? null,
      displayProductCode: productCode || null,
      name: product.name,
    };
    const fromUrl = resolveActiveSpecialDealPackageForProduct(searchParams.get("deal"), productMeta);
    if (fromUrl) {
      return fromUrl;
    }
    const cartEditId = searchParams.get("cartEdit")?.trim();
    if (!cartEditId) {
      return null;
    }
    const line = getCartItems().find((row) => row.id === cartEditId);
    if (!line?.specialDealPackageId) {
      return null;
    }
    return resolveActiveSpecialDealPackageForProduct(line.specialDealPackageId, productMeta);
  }, [searchParams, product.slug, product.name, productCode]);

  const dealMaxLogoFiles = activeDealPackage?.maxLogos ?? MAX_LOGO_FILES;
  const slugLowerForBrand = (product.slug ?? "").trim().toLowerCase();
  const nameLowerForBrand = (product.name ?? "").trim().toLowerCase();
  const supLowerForBrand = (product.supplierName ?? "").trim().toLowerCase();
  /** Fashion-Biz slugs use `…-bizcollection-{style}`; supplier row is sometimes not literally "Biz Collection". */
  const isBizCollection =
    supLowerForBrand.includes("biz collection") ||
    slugLowerForBrand.includes("bizcollection") ||
    nameLowerForBrand.includes("biz collection");
  const brandAndModelLine = useMemo(() => {
    if (product.displayBrandSkuLine && product.displayBrandSkuLine.trim().length > 0) {
      return product.displayBrandSkuLine.trim();
    }
    const fromName = storefrontLeadingSupplierBrand(product.name);
    const fromSupplierName = product.supplierName?.trim() ? product.supplierName.trim() : null;
    const slug = (product.slug ?? "").trim().toLowerCase();
    const supplierLower = (fromSupplierName ?? "").toLowerCase();
    const inferredFromSlug =
      slug.startsWith("fb-syzmik-") || slug.includes("syzmik")
        ? "Syzmik"
        : slug.startsWith("bis-") || slug.includes("bisley")
          ? "Bisley"
          : slug.startsWith("jb-") || slug.includes("jbswear")
            ? "JB's Wear"
            : null;
    const brand = fromName ?? fromSupplierName ?? inferredFromSlug;
    if (supplierLower === "aussie pacific" || slug.startsWith("ap-")) {
      return `Aussie Pacific / ${productCode}`;
    }
    return brand ? `${brand} / ${productCode}` : productCode;
  }, [product.displayBrandSkuLine, product.name, product.slug, product.supplierName, productCode]);
  const displayDescription = useMemo(() => {
    const base =
      typeof serverPdpDescriptionFromRsc === "string"
        ? serverPdpDescriptionFromRsc
        : typeof product.pdpDescriptionBody === "string"
          ? product.pdpDescriptionBody
          : productDetailDescriptionBody(
      product.description,
      productName,
      product.supplierName,
      product.slug,
      product.name,
            );
    if (!base) {
      return base;
    }
    if (isSyzmikStorefrontProduct(product.slug, product.supplierName)) {
      return syzmikFormatDescriptionFeaturesColonAndCommas(syzmikFormatDescriptionSemicolonLineBreaks(base));
    }
    return base;
  }, [
    product.description,
    product.name,
    product.pdpDescriptionBody,
    productName,
    product.supplierName,
    product.slug,
    serverPdpDescriptionFromRsc,
  ]);

  const displayFeatures = useMemo(() => {
    const base = typeof product.features === "string" ? product.features : "";
    if (!base) return base;
    if (isSyzmikStorefrontProduct(product.slug, product.supplierName)) {
      return syzmikFormatFeaturesCommaToTabbedBullets(base);
    }
    return base;
  }, [product.features, product.slug, product.supplierName]);
  const cartLabel = pdpProductTitle ? `${pdpProductTitle} (${productCode})` : productCode;
  const heroAlt = cartLabel;
  const related = product.relatedProducts ?? [];

  const productImageUrlsForGallery = useMemo((): string[] => {
    const raw = product.imageUrls ?? [];
    const slugLower = (product.slug ?? "").trim().toLowerCase();
    if (!bisleySlugUsesPositionalColorGallery(slugLower) || raw.length < 2) {
      return raw;
    }
    const strict = bisleySortedPositionalImageUrlsIfComplete(raw);
    if (strict) return strict;
    const byDb = bisleyReorderDrillImagesToMatchColors(raw, effectivePdpColorOptions(product));
    return byDb ?? raw;
  }, [product.imageUrls, product.slug]);

  const galleryParsed = useMemo(
    () => parseJbGalleryUrls(productImageUrlsForGallery),
    [productImageUrlsForGallery],
  );

  const galleryImages = useMemo(
    () => galleryForUrls(galleryParsed.urls),
    [galleryParsed.urls],
  );

  const galleryPickOpts = useMemo((): GalleryColorPickOpts => {
    const isJb = isJbWearStorefrontProduct(product.slug, product.supplierName);
    const slugLower = (product.slug ?? "").trim().toLowerCase();
    const supLower = (product.supplierName ?? "").trim().toLowerCase();
    const isAussiePacific =
      supLower === "aussie pacific" || slugLower.startsWith("ap-") || /\baussie\s+pacific\b/i.test(product.supplierName ?? "");
    const forceOpaqueColorIndex =
      isAussiePacific || bisleySlugUsesPositionalColorGallery(slugLower);
    return {
      colorOptions,
      jbPrefixCount: galleryParsed.prefixCount,
      isJbWear: isJb,
      jbStyleCodeUpper: jbStyleCodeUpperFromSlug(product.slug),
      forceOpaqueColorIndex,
      opaqueProportionalBuckets: isAussiePacific,
      productSlug: product.slug ?? null,
      isAp2310Listing: isAp2310StorefrontProduct(product),
    };
  }, [
    colorOptions,
    galleryParsed.prefixCount,
    product.description,
    product.displayProductCode,
    product.name,
    product.slug,
    product.supplierName,
  ]);

  const ppePlainOnly = useMemo(
    () =>
      isPpeStorefrontProduct(
        product.name,
        product.category,
        product.slug ?? null,
        product.description,
      ),
    [product.category, product.description, product.name, product.slug],
  );

  const placementOptions: PlacementOption[] = useMemo(
    () =>
      placements.map((item) => {
        const nameForCodes = item.name.replace(/\s+/g, " ").trim();
        const normalizedName = nameForCodes.toLowerCase();
        const diagramAbbr =
          normalizedName === "right chest"
            ? "RC"
            : normalizedName === "full back" ||
                normalizedName === "front full" ||
                normalizedName === "front bottom"
              ? "FB"
              : toShortCode(nameForCodes);
        const short =
          normalizedName === "right chest"
            ? "RC for Names"
            : normalizedName === "full back" ||
                normalizedName === "front full" ||
                normalizedName === "front bottom"
              ? "FB"
              : toShortCode(nameForCodes);
        return {
          id: item.id,
          label: nameForCodes,
          short,
          diagramAbbr,
          embroideryCost:
            defaultEmbroideryPlacementPricing[normalizedName] ?? PLACEMENT_FALLBACK_EMBROIDERY,
          printingCost: defaultPrintingPlacementPricing[normalizedName] ?? PLACEMENT_FALLBACK_PRINTING,
        };
      }),
    [placements]
  );

  const placementOptionsForUi = useMemo(() => {
    if (!activeDealPackage) {
      return placementOptions;
    }
    return filterPlacementsForSpecialDealPackage(placementOptions);
  }, [activeDealPackage, placementOptions]);

  useEffect(() => {
    setPlacementAssignments((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, svc] of Object.entries(prev)) {
        if (svc !== "Embroidery") {
          continue;
        }
        const opt = placementOptions.find((o) => o.id === id);
        if (opt && !isEmbroideryOfferedForPlacement(opt.diagramAbbr)) {
          next[id] = null;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [placementOptions]);

  useEffect(() => {
    if (!activeDealPackage) {
      return;
    }
    const allowedIds = new Set(placementOptionsForUi.map((o) => o.id));
    setPlacementAssignments((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!allowedIds.has(id) && next[id]) {
          next[id] = null;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeDealPackage, placementOptionsForUi]);

  const [selectedServices, setSelectedServices] = useState<Record<DecoratedServiceType, boolean>>({
    Embroidery: false,
    Printing: false,
  });
  const initialColors = effectivePdpColorOptions(product);
  const [selectedColor, setSelectedColor] = useState<string>(initialColors[0] ?? "");
  const selectedColorIsDiscontinued = /\bdiscontinued\b/i.test(selectedColor);
  const [placementAssignments, setPlacementAssignments] = useState<
    Record<string, DecoratedServiceType | null>
  >({});
  const [colorSizeQuantities, setColorSizeQuantities] = useState<
    Record<string, Record<string, number>>
  >(() => emptyColorSizeQuantities(initialColors, product.sizeOptions));
  const [activeImage, setActiveImage] = useState<string>(() => {
    const rawUrls = product.imageUrls ?? [];
    const slugLower = (product.slug ?? "").trim().toLowerCase();
    const urlsForPick =
      bisleySlugUsesPositionalColorGallery(slugLower) && rawUrls.length >= 4
        ? (bisleySortedPositionalImageUrlsIfComplete(rawUrls) ?? rawUrls)
        : rawUrls;
    const { urls, prefixCount } = parseJbGalleryUrls(urlsForPick);
    const g = galleryForUrls(urls);
    const supLower = (product.supplierName ?? "").trim().toLowerCase();
    const isAussiePacific =
      supLower === "aussie pacific" || slugLower.startsWith("ap-") || /\baussie\s+pacific\b/i.test(product.supplierName ?? "");
    const forceOpaqueColorIndex =
      isAussiePacific || bisleySlugUsesPositionalColorGallery(slugLower);
    return pickPrimaryImageForColor(initialColors[0] ?? "", g, {
      colorOptions: initialColors,
      jbPrefixCount: prefixCount,
      isJbWear: isJbWearStorefrontProduct(product.slug, product.supplierName),
      forceOpaqueColorIndex,
      opaqueProportionalBuckets: isAussiePacific,
      productSlug: product.slug ?? null,
      isAp2310Listing: isAp2310StorefrontProduct(product),
    });
  });
  const [cartMessage, setCartMessage] = useState<string>("");
  const [cartSubmitBusy, setCartSubmitBusy] = useState(false);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [logoAttachments, setLogoAttachments] = useState<LogoAttachmentRow[]>([]);
  const [logoDropActive, setLogoDropActive] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoDragDepthRef = useRef(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [heroLightboxOpen, setHeroLightboxOpen] = useState(false);
  /** Which block of `GALLERY_THUMB_PAGE_SIZE` gallery thumbnails is visible under the hero. */
  const [galleryThumbPage, setGalleryThumbPage] = useState(0);
  /** Set when opening this product via Cart → Edit; primary button updates that line instead of adding. */
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const prevProductIdRef = useRef(product.id);
  const galleryImagesRef = useRef(galleryImages);
  const galleryPickOptsRef = useRef(galleryPickOpts);
  /** First thumbnail “page” — measured for slide viewport width + `translateX` step. */
  const galleryThumbFirstPageMeasureRef = useRef<HTMLDivElement | null>(null);
  const [galleryThumbSlideViewportPx, setGalleryThumbSlideViewportPx] = useState(0);
  galleryImagesRef.current = galleryImages;
  galleryPickOptsRef.current = galleryPickOpts;

  function appendLogoFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const incoming = Array.from(fileList as FileList);
    setLogoAttachments((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= dealMaxLogoFiles) {
          break;
        }
        if (!isAllowedLogoFile(file) || file.size > MAX_LOGO_BYTES) {
          continue;
        }
        if (next.some((x) => x.file.name === file.name && x.file.size === file.size)) {
          continue;
        }
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
        next.push({ key: crypto.randomUUID(), file, previewUrl });
      }
      return next;
    });
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  }

  const sizeGuideKind = useMemo(
    () => inferSizeGuideKind(product.sizeOptions, product.name),
    [product.name, product.sizeOptions],
  );
  const sizeGuideBundle = useMemo(
    () => getSizeGuideBundle(sizeGuideKind, product.name),
    [product.name, sizeGuideKind],
  );
  const colourCount = colorOptions.length;
  const manyColours = colourCount >= 10;

  const galleryThumbPages = useMemo(() => {
    const pages: string[][] = [];
    for (let i = 0; i < galleryImages.length; i += GALLERY_THUMB_PAGE_SIZE) {
      pages.push(galleryImages.slice(i, i + GALLERY_THUMB_PAGE_SIZE));
    }
    return pages.length > 0 ? pages : [[]];
  }, [galleryImages]);
  const galleryThumbPageCount = Math.max(1, galleryThumbPages.length);
  const effectiveGalleryThumbPage = Math.min(galleryThumbPage, galleryThumbPageCount - 1);
  const galleryThumbSliceStart = effectiveGalleryThumbPage * GALLERY_THUMB_PAGE_SIZE;
  const currentThumbPage = galleryThumbPages[effectiveGalleryThumbPage] ?? [];
  const galleryThumbNavVisible = galleryImages.length > GALLERY_THUMB_PAGE_SIZE;

  const sizeGuideDownloadSlug = (product.slug?.trim() || productCode || product.id).replace(
    /[^a-z0-9-]+/gi,
    "",
  );
  const supplierSizeChartLinks = useMemo(
    () => resolveSupplierSizeChartLinks(product.name, product.slug ?? null),
    [product.name, product.slug],
  );

  /** When the image set changes, re-pick hero for the current colour (chip / thumbnail clicks set hero directly). */
  useEffect(() => {
    setActiveImage(pickPrimaryImageForColor(selectedColor, galleryImages, galleryPickOpts));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fixed dep count for Fast Refresh; `selectedColor` is latest on each render when `galleryImages` / `galleryPickOpts` change.
  }, [galleryImages, galleryPickOpts]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(galleryImages.length / GALLERY_THUMB_PAGE_SIZE) - 1);
    setGalleryThumbPage((p) => Math.min(p, maxPage));
  }, [galleryImages.length]);

  useLayoutEffect(() => {
    const el = galleryThumbFirstPageMeasureRef.current;
    if (!el) {
      return;
    }
    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      setGalleryThumbSlideViewportPx((prev) => (w > 0 && w !== prev ? w : prev));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const raf = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [galleryImages]);

  useEffect(() => {
    const idx = galleryImages.indexOf(activeImage);
    if (idx < 0) {
      return;
    }
    const page = Math.floor(idx / GALLERY_THUMB_PAGE_SIZE);
    setGalleryThumbPage((prev) => (prev === page ? prev : page));
  }, [activeImage, galleryImages]);

  useEffect(() => {
    if (prevProductIdRef.current !== product.id) {
      setEditingCartItemId(null);
      setGalleryThumbPage(0);
      setGalleryThumbSlideViewportPx(0);
      prevProductIdRef.current = product.id;
    }
  }, [product.id]);

  useEffect(() => {
    setColorSizeQuantities(emptyColorSizeQuantities(colorOptions, product.sizeOptions));
    setLogoAttachments(logoAttachmentsFlushReducer);
  }, [colorOptions, product.id, product.sizeOptions]);

  useEffect(() => {
    if (!activeDealPackage || searchParams.get("cartEdit")?.trim()) {
      return;
    }
    setSelectedServices({ Embroidery: true, Printing: false });
    setPlacementAssignments({});
  }, [activeDealPackage, searchParams]);

  /** Refs keep a fixed dependency list (avoids Fast Refresh errors if hook dep count changes across edits). */
  useEffect(() => {
    const cartEditId = searchParams.get("cartEdit")?.trim();
    if (!cartEditId) {
      return;
    }

    const line = getCartItems().find((row) => row.id === cartEditId);
    if (!line) {
      setCartMessage("Cart line not found. It may have been removed.");
      router.replace(pathname, { scroll: false });
      return;
    }
    if (line.productId !== product.id) {
      setCartMessage("This cart item is for a different product. Use Edit on the matching line in your cart.");
      router.replace(pathname, { scroll: false });
      return;
    }

    const { emb, prn } = parseCartServiceFlags(line.serviceType ?? "");
    setSelectedServices({ Embroidery: emb, Printing: prn });

    const color = (line.color ?? "").trim();
    const size = (line.size ?? "").trim();
    const nextColor = colorOptions.includes(color) ? color : (colorOptions[0] ?? "");
    setSelectedColor(nextColor);
    setActiveImage(
      pickPrimaryImageForColor(nextColor, galleryImagesRef.current, galleryPickOptsRef.current),
    );

    const q = Number(line.quantity);
    const next = emptyColorSizeQuantities(colorOptions, product.sizeOptions);
    if (
      colorOptions.includes(color) &&
      product.sizeOptions.includes(size) &&
      Number.isFinite(q) &&
      q > 0
    ) {
      next[color][size] = Math.min(999, Math.floor(q));
    }
    setColorSizeQuantities(next);

    setOrderNotes((line.notes ?? "").trim());
    setPlacementAssignments(placementAssignmentsFromCartLines(line.placements ?? [], placementOptions));

    setLogoAttachments(logoAttachmentsFlushReducer);
    setEditingCartItemId(cartEditId);
    setCartMessage("Selections loaded from your cart. Change as needed, then press Update to save.");

    router.replace(pathname, { scroll: false });
  }, [
    searchParams,
    product.id,
    colorOptions,
    product.sizeOptions,
    pathname,
    router,
    placementOptions,
  ]);

  const cartEditKey = searchParams.get("cartEdit")?.trim() ?? "";

  useEffect(() => {
    if (!ppePlainOnly) {
      return;
    }
    setSelectedServices({ Embroidery: false, Printing: false });
    setPlacementAssignments({});
    setOrderNotes("");
    setLogoAttachments(logoAttachmentsFlushReducer);
  }, [ppePlainOnly, product.id, cartEditKey]);

  const isEmbroiderySelected = selectedServices.Embroidery;
  const isPrintingSelected = selectedServices.Printing;
  const isPlainSelected = !isEmbroiderySelected && !isPrintingSelected;

  const perItemPrice = useMemo(() => {
    if (activeDealPackage) {
      return activeDealPackage.totalAud / activeDealPackage.units;
    }
    let placementCostCents = 0;
    for (const [placementId, service] of Object.entries(placementAssignments)) {
      if (service !== "Embroidery" && service !== "Printing") {
        continue;
      }
      const opt = placementOptions.find((o) => o.id === placementId);
      if (!opt) {
        continue;
      }
      if (service === "Embroidery" && !isEmbroideryOfferedForPlacement(opt.diagramAbbr)) {
        continue;
      }
      placementCostCents += cents(service === "Embroidery" ? opt.embroideryCost : opt.printingCost);
    }
    const perItemCents = cents(product.basePrice) + placementCostCents;
    return perItemCents / 100;
  }, [activeDealPackage, placementAssignments, placementOptions, product.basePrice]);

  const totalPieces = useMemo(() => {
    let sum = 0;
    for (const color of colorOptions) {
      const sq = colorSizeQuantities[color];
      if (!sq) {
        continue;
      }
      for (const size of product.sizeOptions) {
        sum += Math.max(0, Math.floor(sq[size] ?? 0));
      }
    }
    return sum;
  }, [colorOptions, product.sizeOptions, colorSizeQuantities]);

  const totalPrice = useMemo(() => {
    if (totalPieces <= 0) {
      return 0;
    }
    if (activeDealPackage && totalPieces === activeDealPackage.units) {
      return activeDealPackage.totalAud;
    }
    if (activeDealPackage) {
      return 0;
    }
    const gross = perItemPrice * totalPieces;
    const rate = storefrontVolumeDiscountRateFromSubtotalAud(gross);
    return Math.round(gross * (1 - rate) * 100) / 100;
  }, [activeDealPackage, perItemPrice, totalPieces]);

  function assignPlacement(id: string, service: DecoratedServiceType) {
    if (ppePlainOnly) {
      return;
    }
    if (!selectedServices[service]) {
      return;
    }
    if (service === "Embroidery") {
      const opt = placementOptions.find((o) => o.id === id);
      if (opt && !isEmbroideryOfferedForPlacement(opt.diagramAbbr)) {
        return;
      }
    }

    setPlacementAssignments((prev) => {
      const current = prev[id] ?? null;
      const nextAssign = current === service ? null : service;
      if (activeDealPackage) {
        if (!nextAssign) {
          return {};
        }
        return { [id]: nextAssign };
      }
      return {
        ...prev,
        [id]: nextAssign,
      };
    });
  }

  function handleServiceChange(service: ServiceType) {
    if (activeDealPackage && service === "Plain") {
      return;
    }
    if (ppePlainOnly && service !== "Plain") {
      return;
    }
    if (service === "Plain") {
      setSelectedServices({ Embroidery: false, Printing: false });
      setPlacementAssignments({});
      setOrderNotes("");
      return;
    }

    if (activeDealPackage && (service === "Embroidery" || service === "Printing")) {
      setSelectedServices((prev) => {
        const turningOn = service === "Embroidery" ? !prev.Embroidery : !prev.Printing;
        if (!turningOn) {
          return { ...prev, [service]: false };
        }
        return service === "Embroidery"
          ? { Embroidery: true, Printing: false }
          : { Embroidery: false, Printing: true };
      });
      setPlacementAssignments({});
      return;
    }

    setSelectedServices((prev) => {
      const next = {
        ...prev,
        [service]: !prev[service],
      };

      if (!next[service]) {
        setPlacementAssignments((currentAssignments) => {
          const cleaned: Record<string, DecoratedServiceType | null> = {};
          Object.entries(currentAssignments).forEach(([placementId, assignedService]) => {
            cleaned[placementId] = assignedService === service ? null : assignedService;
          });
          return cleaned;
        });
      }

      return next;
    });
  }

  async function handleAddToCart() {
    if (cartSubmitBusy) {
      return;
    }

    const lines: { color: string; size: string; qty: number }[] = [];
    for (const color of colorOptions) {
      const sq = colorSizeQuantities[color] ?? emptySizeQuantities(product.sizeOptions);
      for (const size of product.sizeOptions) {
        const qty = Math.max(0, Math.min(999, Math.floor(sq[size] ?? 0)));
        if (qty > 0) {
          lines.push({ color, size, qty });
        }
      }
    }

    if (lines.length === 0) {
      setCartMessage("Set quantity for at least one size (per colour).");
      return;
    }

    const pieceQtySum = lines.reduce((s, l) => s + l.qty, 0);

    if (logoAttachments.length > 0 && !readBrowserCookie("customer_email").trim()) {
      setCartMessage("Please sign in and save your email in account details to attach logo files.");
      return;
    }

    const placementLabels = placementOptions
      .map((item) => {
        const assignedService = placementAssignments[item.id];
        return assignedService ? `${assignedService}: ${item.label}` : null;
      })
      .filter((item): item is string => Boolean(item));

    if (activeDealPackage) {
      if (!isEmbroiderySelected && !isPrintingSelected) {
        setCartMessage("Choose logo embroidery or printing for this deal.");
        return;
      }
      if (pieceQtySum !== activeDealPackage.units) {
        setCartMessage(
          `This deal includes exactly ${activeDealPackage.units} shirts — adjust sizes to total ${activeDealPackage.units}.`,
        );
        return;
      }
      if (placementLabels.length < 1) {
        setCartMessage("Select one logo placement for this deal.");
        return;
      }
      if (placementLabels.length > activeDealPackage.maxPlacements) {
        setCartMessage(`This deal includes ${activeDealPackage.maxPlacements} logo placement only.`);
        return;
      }
      if (logoAttachments.length > activeDealPackage.maxLogos) {
        setCartMessage(`Upload ${activeDealPackage.maxLogos} logo file for this deal.`);
        return;
      }
    }

    /** List-price batch total (cents). Volume discount is applied at cart / checkout on full-cart subtotal. */
    const grossBatchCents = activeDealPackage
      ? Math.round(activeDealPackage.totalAud * 100)
      : pieceQtySum > 0
        ? Math.round(perItemPrice * pieceQtySum * 100)
        : 0;

    const serviceLabel = isPlainSelected
      ? "Plain"
      : [isEmbroiderySelected ? "Embroidery" : "", isPrintingSelected ? "Printing" : ""]
          .filter(Boolean)
          .join(" + ");

    const trimmedNotes = orderNotes.trim();
    const logoExtra =
      logoAttachments.length > 0
        ? `\n\n[Logo files with this line: ${logoAttachments.map((a) => `${a.file.name} (${Math.round(a.file.size / 1024)} KB)`).join(", ")}]`
        : "";
    const dealNote = activeDealPackage ? `\n\n${specialDealPackageNote(activeDealPackage)}` : "";
    const notesForCart = (trimmedNotes + dealNote + logoExtra).trim().slice(0, 2000);
    const fallbackHero = galleryImages.find((u) => typeof u === "string" && u.trim().length > 0)?.trim();

    setCartSubmitBusy(true);
    try {
      let sharedRefUrls: string[] | undefined;
      if (logoAttachments.length > 0) {
        const fd = new FormData();
        for (const a of logoAttachments) {
          fd.append("files", a.file);
        }
        const up = await uploadStoreCheckoutReferenceImages(fd);
        if (!up.ok) {
          setCartMessage(up.error);
          return;
        }
        sharedRefUrls = up.urls;
      } else if (editingCartItemId) {
        const existing = getCartItems().find((row) => row.id === editingCartItemId);
        if (existing?.referenceImageUrls?.length) {
          sharedRefUrls = [...existing.referenceImageUrls];
        }
      }

      function linePayload(
        lineColor: string,
        size: string,
        qty: number,
        lineTotalAud: number,
      ): Omit<CartItem, "id" | "addedAt"> {
        const colorHero = pickPrimaryImageForColor(lineColor, galleryImages, galleryPickOpts)?.trim();
        const heroImage = colorHero || fallbackHero;
        const listUnitAud = perItemPrice;
        const unitAud = qty > 0 ? Math.round((lineTotalAud / qty) * 100) / 100 : listUnitAud;
        return {
          productId: product.id,
          supplierName: product.supplierName?.trim() || undefined,
          productPathSlug: productPathSegment({ name: product.name, slug: product.slug ?? null }),
          imageUrl: heroImage,
          productName: cartLabel,
          category: product.category?.trim() || undefined,
          serviceType: serviceLabel,
          color: lineColor,
          size,
          quantity: qty,
          placements: placementLabels,
          listUnitPrice: listUnitAud,
          unitPrice: unitAud,
          totalPrice: lineTotalAud,
          notes: notesForCart.length > 0 ? notesForCart : undefined,
          ...(sharedRefUrls && sharedRefUrls.length > 0 ? { referenceImageUrls: sharedRefUrls } : {}),
          ...(activeDealPackage ? { specialDealPackageId: activeDealPackage.id } : {}),
        };
      }

      let allocatedLineCents = 0;
      function lineTotalAudForLine(qty: number, lineIndex: number): number {
        const isLast = lineIndex === lines.length - 1;
        const lineCents = isLast
          ? grossBatchCents - allocatedLineCents
          : Math.round((grossBatchCents * qty) / pieceQtySum);
        if (!isLast) {
          allocatedLineCents += lineCents;
        }
        return lineCents / 100;
      }

      if (editingCartItemId) {
        if (lines.length === 1) {
          const { color: lineColor, size, qty } = lines[0];
          const ok = updateCartItem(
            editingCartItemId,
            linePayload(lineColor, size, qty, lineTotalAudForLine(qty, 0)),
          );
          if (ok) {
            setEditingCartItemId(null);
            setColorSizeQuantities(emptyColorSizeQuantities(colorOptions, product.sizeOptions));
            setOrderNotes("");
            setLogoAttachments(logoAttachmentsFlushReducer);
            setCartMessage("Cart updated.");
            return;
          }
          setEditingCartItemId(null);
          setCartMessage(
            "That line is no longer in your cart. Adjust selections and tap Add to cart if you want a new line.",
          );
          return;
        }

        removeCartItem(editingCartItemId);
        setEditingCartItemId(null);
        allocatedLineCents = 0;
        for (let i = 0; i < lines.length; i++) {
          const { color: lineColor, size, qty } = lines[i];
          addCartItem(linePayload(lineColor, size, qty, lineTotalAudForLine(qty, i)));
        }
        setColorSizeQuantities(emptyColorSizeQuantities(colorOptions, product.sizeOptions));
        setOrderNotes("");
        setLogoAttachments(logoAttachmentsFlushReducer);
        setCartMessage(`Cart updated: ${lines.length} lines added (sizes / colours).`);
        return;
      }

      allocatedLineCents = 0;
      for (let i = 0; i < lines.length; i++) {
        const { color: lineColor, size, qty } = lines[i];
        addCartItem(linePayload(lineColor, size, qty, lineTotalAudForLine(qty, i)));
      }

      setColorSizeQuantities(emptyColorSizeQuantities(colorOptions, product.sizeOptions));
      setOrderNotes("");
      setLogoAttachments(logoAttachmentsFlushReducer);
      setCartMessage(lines.length > 1 ? `Added ${lines.length} lines to your cart.` : "Added to cart.");
    } finally {
      setCartSubmitBusy(false);
    }
  }

  function removeLogoAttachment(key: string) {
    setLogoAttachments((prev) => {
      const row = prev.find((r) => r.key === key);
      if (row?.previewUrl) {
        URL.revokeObjectURL(row.previewUrl);
      }
      return prev.filter((r) => r.key !== key);
    });
  }

  function onLogoZoneDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    logoDragDepthRef.current += 1;
    setLogoDropActive(true);
  }

  function onLogoZoneDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    logoDragDepthRef.current -= 1;
    if (logoDragDepthRef.current <= 0) {
      logoDragDepthRef.current = 0;
      setLogoDropActive(false);
    }
  }

  function onLogoZoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onLogoZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    logoDragDepthRef.current = 0;
    setLogoDropActive(false);
    appendLogoFiles(e.dataTransfer.files);
  }

  useEffect(() => {
        syncSidebarNavFromProductIfNeeded(
          product.name,
          product.category,
          product.slug,
          product.supplierName?.trim() ?? null,
          product.description,
        );
  }, [product.category, product.description, product.name, product.slug, product.supplierName]);

  const showDecoratedServiceFlow =
    !ppePlainOnly && (isEmbroiderySelected || isPrintingSelected);

  const renderRealtimeTotalPricePanel = (useStickyOnLargeScreens: boolean) => (
    <>
      <div
        className={`rounded-2xl border border-brand-navy/15 bg-brand-navy p-4 text-white sm:p-5${useStickyOnLargeScreens ? " lg:sticky lg:top-[calc(var(--site-header-height)+1rem)]" : ""}`}
      >
        <h2 className="inline-flex items-center gap-2 text-[1.26rem] font-medium uppercase tracking-[0.1em] text-slate-200">
          <CalculatorIcon className="h-4 w-4" />
          Real-time Total Price
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="mb-1 text-[1.08rem] font-semibold text-slate-300">Total pieces</p>
            <p className="text-[1.44rem] font-light tabular-nums text-white">{totalPieces}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="product-detail-per-item text-[1.26rem] font-light text-slate-300">
              {activeDealPackage
                ? totalPieces === activeDealPackage.units
                  ? `Package (${activeDealPackage.units} shirts + 1 logo)`
                  : `Select ${activeDealPackage.units} shirts for package price`
                : `Per item: ${toCurrency(perItemPrice)}`}
            </p>
            <p className="product-detail-total mt-1 inline-block text-[2.7rem] font-light text-brand-orange tabular-nums">
              {toCurrency(totalPrice)}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-[1.02rem] leading-snug text-slate-100 sm:text-[1.08rem]">
          <p className="font-semibold uppercase tracking-[0.08em] text-slate-300">Your selection</p>
          <p>
            <span className="text-slate-400">Product · </span>
            {cartLabel}
          </p>
          <div>
            <p className="text-slate-400">By colour &amp; size</p>
            {totalPieces > 0 ? (
              <ul className="mt-2 space-y-2 text-slate-100">
                {colorOptions.map((color) => {
                  const sq = colorSizeQuantities[color] ?? emptySizeQuantities(product.sizeOptions);
                  const sizesWithQty = product.sizeOptions.filter((s) => (sq[s] ?? 0) > 0);
                  if (sizesWithQty.length === 0) {
                    return null;
                  }
                  return (
                    <li key={color}>
                      <span className="font-medium text-white">{color}</span>
                      <ul className="mt-0.5 list-inside list-disc space-y-0.5 pl-1 text-slate-200">
                        {sizesWithQty.map((s) => (
                          <li key={`${color}-${s}`} className="tabular-nums">
                            {s} × {sq[s]}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-slate-400">Enter a quantity for at least one size in any colour.</p>
            )}
          </div>
          <p className="border-t border-white/10 pt-2 text-slate-200 tabular-nums">
            <span className="text-slate-400">Total pieces · </span>
            {totalPieces}
          </p>
        </div>
        <button
          type="button"
          disabled={cartSubmitBusy}
          onClick={() => void handleAddToCart()}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-[1.26rem] font-medium text-white transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {cartSubmitBusy ? "Uploading…" : editingCartItemId ? "Update" : "Add to Cart"}
        </button>
        {cartMessage && <p className="mt-2 text-[1.08rem] text-slate-200">{cartMessage}</p>}
      </div>
      {!activeDealPackage ? (
        <p className="product-detail-volume-promo px-1">
          Buy more, Get more discount up to 20%
        </p>
      ) : null}
    </>
  );

  return (
    <main className="product-detail-page min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <div className={STORE_MAIN_SHELL_CLASS}>
        <section className={`${SITE_PAGE_INSET_X_CLASS} pb-6 pt-6 sm:pb-10 sm:pt-10`}>
        <div className="mx-auto grid w-full max-w-none gap-8 lg:grid-cols-[1fr_1fr] lg:gap-10">
        <section className="space-y-3 sm:space-y-4">
          <button
            type="button"
            onClick={() => activeImage && setHeroLightboxOpen(true)}
            disabled={!activeImage}
            aria-label="View full size image"
            className="group mx-auto flex min-h-[384px] w-[64.8%] max-w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-3xl bg-white text-left transition hover:bg-brand-surface/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[504px] lg:min-h-[624px]"
          >
            <img
              src={activeImage}
              alt={heroAlt}
              className="pointer-events-none h-auto max-h-[384px] w-full max-w-full rounded-3xl object-contain object-center sm:max-h-[504px] lg:max-h-[624px]"
              loading="eager"
              decoding="async"
              suppressHydrationWarning
            />
          </button>
          <div className="mx-auto flex w-full max-w-full items-center justify-center gap-0.5 sm:gap-1">
            {galleryThumbNavVisible ? (
              <button
                type="button"
                aria-label="이전 이미지"
                disabled={effectiveGalleryThumbPage <= 0}
                onClick={() => setGalleryThumbPage((p) => Math.max(0, p - 1))}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-navy/15 bg-white text-brand-navy transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
            ) : null}
            <div
              role="group"
              aria-label={`제품 이미지 ${galleryThumbSliceStart + 1}–${galleryThumbSliceStart + currentThumbPage.length} / 전체 ${galleryImages.length}`}
              className="max-w-full overflow-hidden py-0.5"
              style={galleryThumbSlideViewportPx > 0 ? { width: galleryThumbSlideViewportPx } : undefined}
            >
              <div
                className="flex will-change-transform motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none"
                style={
                  galleryThumbSlideViewportPx > 0
                    ? {
                        transform: `translate3d(-${effectiveGalleryThumbPage * galleryThumbSlideViewportPx}px,0,0)`,
                      }
                    : undefined
                }
              >
                {galleryThumbPages.map((pageUrls, pageIdx) => (
                  <div
                    key={`pdp-gallery-thumb-page-${pageIdx}`}
                    ref={pageIdx === 0 ? galleryThumbFirstPageMeasureRef : undefined}
                    className="flex shrink-0 justify-center gap-2 sm:gap-3"
                    style={
                      galleryThumbSlideViewportPx > 0
                        ? { width: galleryThumbSlideViewportPx, minWidth: galleryThumbSlideViewportPx }
                        : undefined
                    }
                    aria-hidden={pageIdx !== effectiveGalleryThumbPage}
                  >
                    {pageUrls.map((image, localIdx) => {
                      const index = pageIdx * GALLERY_THUMB_PAGE_SIZE + localIdx;
                      const isActive = activeImage === image;

                      return (
                        <button
                          key={`${image}-${index}`}
                          type="button"
                          onClick={() => {
                            setActiveImage(image);
                            const inferred = inferBestColorForGalleryImage(
                              image,
                              colorOptions,
                              galleryImages,
                              galleryPickOpts,
                            );
                            if (inferred != null) {
                              setSelectedColor(inferred);
                            }
                          }}
                          aria-label={`${heroAlt} view ${index + 1}`}
                          aria-current={isActive ? "true" : undefined}
                          suppressHydrationWarning
                          className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white sm:h-24 sm:w-24 ${
                            isActive ? "border-brand-orange" : "border-brand-navy/15"
                          }`}
                        >
                          <img
                            src={image}
                            alt=""
                            className="max-h-full w-full object-contain object-center"
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {galleryThumbNavVisible ? (
              <button
                type="button"
                aria-label="다음 이미지"
                disabled={effectiveGalleryThumbPage >= galleryThumbPageCount - 1}
                onClick={() =>
                  setGalleryThumbPage((p) => Math.min(galleryThumbPageCount - 1, p + 1))
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-navy/15 bg-white text-brand-navy transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11"
              >
                <ArrowRightIcon className="h-5 w-5" />
              </button>
            ) : null}
          </div>
          {galleryThumbNavVisible ? (
            <p className="text-center text-[0.85rem] font-medium tabular-nums text-brand-navy/50">
              이미지 {galleryThumbSliceStart + 1}–{galleryThumbSliceStart + currentThumbPage.length} / 전체{" "}
              {galleryImages.length} · {effectiveGalleryThumbPage + 1} / {galleryThumbPageCount} 페이지
            </p>
          ) : null}
          {displayDescription ? (
            <div className="mt-4 w-full max-w-[36rem] mx-auto space-y-1.5 border-t border-brand-navy/10 pt-4 sm:mt-5 sm:pt-5">
              <h2 className="text-center text-[1.02rem] font-semibold uppercase tracking-[0.1em] text-brand-navy/80">
                DESCRIPTION
              </h2>
              <div className="space-y-1.5 text-left text-[1.08rem] leading-[1.465rem] text-brand-navy/75 sm:text-[1.2rem] sm:leading-[1.6rem]">
                {displayDescription
                  .split(/\n\s*\n/)
                  .map((block) => block.trim())
                  .filter(Boolean)
                  .map((block, i) => (
                    <ProductDescriptionFormattedBlock
                      key={i}
                      block={isBizCollection ? bizCollectionFormatFabricBullets(block) : block}
                    />
                  ))}
              </div>
            </div>
          ) : null}
          {related.length ? (
            <section className="mt-4 w-full max-w-[36rem] mx-auto space-y-3 border-t border-brand-navy/10 pt-4 text-left">
              <h2 className="text-[1.02rem] font-semibold uppercase tracking-[0.1em] text-brand-navy/80">
                Related styles
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {related.map((item) => {
                  const href = `/products/${encodeURIComponent(productPathSegment({ name: item.name, slug: item.slug }))}`;
                  return (
                    <Link
                      key={item.id}
                      href={href}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-brand-navy/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="flex aspect-square w-full items-center justify-center overflow-hidden border-b border-brand-navy/10 bg-white p-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="max-h-full w-full object-contain object-center"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="h-full w-full bg-brand-surface" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1 px-3 py-2">
                        <p className="line-clamp-2 text-[0.98rem] font-medium leading-snug text-brand-navy">
                          {item.name}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
          {displayFeatures?.trim() ? (
            <div className="mt-4 w-full max-w-[36rem] mx-auto space-y-3 border-t border-brand-navy/10 pt-4 text-left">
              <h2 className="text-[1.02rem] font-semibold uppercase tracking-[0.1em] text-brand-navy/80">
                Features of product
              </h2>
              <div className="space-y-3 text-[1.02rem] leading-[1.75rem] text-brand-navy/75 sm:text-[1.14rem] sm:leading-[1.9rem]">
                {displayFeatures
                  .trim()
                  .split(/\n\s*\n/)
                  .map((block) => block.trim())
                  .filter(Boolean)
                  .map((block, i) => (
                    <p key={i} className="whitespace-pre-wrap">
                      {block}
                    </p>
                  ))}
              </div>
            </div>
          ) : null}
          {product.specifications?.trim() ? (
            <div className="mt-4 w-full max-w-[36rem] mx-auto space-y-3 border-t border-brand-navy/10 pt-4 text-left">
              <h2 className="text-[1.02rem] font-semibold uppercase tracking-[0.1em] text-brand-navy/80">
                Product specifications
              </h2>
              <div className="space-y-3 text-[1.02rem] leading-[1.75rem] text-brand-navy/75 sm:text-[1.14rem] sm:leading-[1.9rem]">
                {product.specifications
                  .trim()
                  .split(/\n\s*\n/)
                  .map((block) => block.trim())
                  .filter(Boolean)
                  .map((block, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {block}
                    </p>
                  ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-5 sm:space-y-6 lg:space-y-7">
          {activeDealPackage ? (
            <div className="rounded-2xl border border-brand-orange/35 bg-gradient-to-r from-brand-orange/15 to-brand-navy/5 px-4 py-4 sm:px-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-orange">Special deal</p>
              <p className="mt-1 text-[1.15rem] font-semibold leading-snug text-brand-navy sm:text-[1.25rem]">
                Buy 5 work shirts with logo print or embroidery — {toCurrency(activeDealPackage.totalAud)} total
              </p>
              <p className="mt-2 text-sm text-brand-navy/75">
                Choose colours and sizes totalling {activeDealPackage.units} shirts, place your logo on the left chest
                (LC), upload {activeDealPackage.maxLogos} logo file, then add to cart.
              </p>
            </div>
          ) : null}
          <header className="space-y-2">
            <p className="text-[1.08rem] font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
              {product.category}
            </p>
            {pdpProductTitle ? (
              <>
                <h1 className="product-detail-title text-[3.3696rem] font-medium leading-tight text-brand-navy sm:text-[4.212rem]">
                  {pdpProductTitle}
                </h1>
                <p className="product-detail-sku text-[2.16rem] font-light text-black">
                  {brandAndModelLine}
                </p>
                {product.googleRating ? <ProductGoogleRatingRow info={product.googleRating} /> : null}
              </>
            ) : (
              <>
                <h1 className="product-detail-sku text-[2.16rem] font-light text-black">
                  {brandAndModelLine}
                </h1>
                {product.googleRating ? <ProductGoogleRatingRow info={product.googleRating} /> : null}
              </>
            )}
            <p className="product-detail-list-price w-full text-right text-[2.16rem] font-light text-black tabular-nums">
              {product.originalPrice != null ? (
                <>
                  <span className="product-detail-price-strike text-[1.44rem] font-light text-brand-navy/55 line-through mr-2">
                    {toCurrency(product.originalPrice)}
                  </span>
                  {toCurrency(product.basePrice)}
                </>
              ) : (
                toCurrency(product.basePrice)
              )}
            </p>
            <p className="text-right text-sm text-brand-navy/55">
              Includes {Math.round(STOREFRONT_RETAIL_GST_RATE * 100)}% GST.
            </p>
          </header>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
                1. Colour
              </h2>
              {manyColours ? (
                <span className="text-[0.95rem] font-medium tabular-nums text-brand-navy/55">
                  {colourCount} colours
                </span>
              ) : null}
            </div>
            {manyColours ? (
              <p className="text-[1.02rem] leading-snug text-brand-navy/60">
                Many colours: scroll the grid below to see them all.
              </p>
            ) : null}
            <div
              className={
                manyColours
                  ? "max-h-[min(52vh,26rem)] overflow-y-auto overscroll-y-contain"
                  : ""
              }
            >
              <div
                className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${colourCount >= 12 ? "gap-1.5" : "gap-2"}`}
              >
                {colorOptions.map((color) => {
                  const isActive = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color);
                        setActiveImage(pickPrimaryImageForColor(color, galleryImages, galleryPickOpts));
                      }}
                      title={color}
                      className={`min-h-[2.75rem] rounded-lg border px-2 py-2 text-center text-[1.02rem] font-semibold leading-snug transition sm:min-h-0 sm:px-2.5 sm:py-2 sm:text-[1.08rem] md:text-[1.05rem] ${
                        manyColours ? "line-clamp-2 sm:line-clamp-2" : ""
                      } ${
                        isActive
                          ? "border-brand-orange bg-brand-orange/15 text-brand-navy ring-1 ring-brand-orange/30"
                          : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange"
                      }`}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
              2. Size &amp; quantity
            </h2>
            <p className="text-[1.08rem] text-brand-navy/65">
              {activeDealPackage
                ? `This deal includes exactly ${activeDealPackage.units} shirts in total. Split them across colours and sizes below (${totalPieces} of ${activeDealPackage.units} selected).`
                : "Quantities are saved per colour. Switch colour to enter a different breakdown — your other colours stay as you left them. Add to cart adds every colour and size with a quantity greater than zero."}
            </p>
            <p className="text-[1.02rem] font-semibold text-brand-navy/80">
              Editing: <span className="text-brand-orange">{selectedColor || "—"}</span>
            </p>
            {selectedColorIsDiscontinued ? (
              <p className="rounded-lg border border-brand-navy/10 bg-brand-surface px-3 py-2 text-[1.02rem] font-medium text-brand-navy/70">
                This colour is discontinued. Size &amp; quantity entry is disabled.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {product.sizeOptions.map((size) => {
                const row =
                  colorSizeQuantities[selectedColor] ?? emptySizeQuantities(product.sizeOptions);
                const sizeQtyId = `size-qty-${compactColorKey(selectedColor)}-${compactColorKey(size)}`;
                return (
                  <div
                  key={size}
                  className="flex flex-col gap-1.5 rounded-xl bg-white px-3 py-2.5"
                >
                  <span className="text-[1.26rem] font-semibold text-brand-navy">{size}</span>
                  <label htmlFor={sizeQtyId} className="sr-only">
                    Quantity for {selectedColor} size {size}
                  </label>
                  <input
                    id={sizeQtyId}
                    type="number"
                    min={0}
                    max={999}
                    inputMode="numeric"
                    disabled={selectedColorIsDiscontinued}
                    value={row[size] ?? 0}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(999, Math.floor(Number(e.target.value) || 0)));
                      setColorSizeQuantities((prev) => {
                        const base = prev[selectedColor] ?? emptySizeQuantities(product.sizeOptions);
                        return {
                          ...prev,
                          [selectedColor]: { ...base, [size]: v },
                        };
                      });
                    }}
                    className={`w-full rounded-lg border border-brand-navy/20 bg-brand-surface/40 px-2 py-1.5 text-[1.26rem] text-brand-navy tabular-nums focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange ${
                      selectedColorIsDiscontinued ? "cursor-not-allowed opacity-50" : ""
                    }`}
                  />
                  </div>
                );
              })}
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setSizeGuideOpen(true)}
                disabled={selectedColorIsDiscontinued}
                className="text-[1.26rem] font-semibold text-brand-navy underline decoration-2 decoration-brand-orange/60 underline-offset-2 transition hover:text-brand-orange hover:decoration-brand-orange"
              >
                Size guide — measurements &amp; how to choose
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
              3. Service Type
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Column 1 aligns with Placement Selector diagram icons (LC/RC/CC...) */}
              {(() => {
                const service: ServiceType = "Plain";
                const isActive = isPlainSelected;
                const buttonArtSrc = isActive
                  ? SERVICE_TYPE_BUTTON_IMAGE_SELECTED[service]
                  : SERVICE_TYPE_BUTTON_IMAGE[service];
                const plainDisabled = Boolean(activeDealPackage);
                return (
                  <button
                    key={service}
                    type="button"
                    disabled={plainDisabled}
                    aria-label="Plain"
                    aria-pressed={isActive}
                    aria-disabled={plainDisabled}
                    onClick={() => handleServiceChange(service)}
                    className={`relative justify-self-center w-[40%] max-w-full overflow-hidden rounded-[2rem] border-0 bg-transparent p-0 transition-shadow duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange sm:rounded-[2.35rem] ${
                      plainDisabled ? "cursor-not-allowed opacity-40" : ""
                    } ${
                      isActive
                        ? "shadow-[0_10px_28px_-8px_rgba(0,31,63,0.3)]"
                        : SERVICE_TYPE_BUTTON_SHADOW_IDLE[service]
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- static assets in public/button */}
                    <img
                      src={buttonArtSrc}
                      alt=""
                      width={512}
                      height={512}
                      draggable={false}
                      className="pointer-events-none h-auto w-full select-none object-contain"
                    />
                  </button>
                );
              })()}

              {/* Columns 2-3 align with Embroidery / Printing price buttons */}
              {(Array.from(["Embroidery", "Printing"]) as ServiceType[]).map((service) => {
                const disabled = ppePlainOnly && service !== "Plain";
                const isActive = service === "Embroidery" ? isEmbroiderySelected : isPrintingSelected;
                const label = service === "Printing" ? "Print" : service;
                const activeGlowClass =
                  service === "Printing"
                    ? "shadow-[0_10px_28px_-8px_rgba(59,130,246,0.38)]"
                    : "shadow-[0_10px_28px_-8px_rgba(255,133,27,0.38)]";
                const buttonArtSrc = isActive
                  ? SERVICE_TYPE_BUTTON_IMAGE_SELECTED[service]
                  : SERVICE_TYPE_BUTTON_IMAGE[service];
                return (
                  <button
                    key={service}
                    type="button"
                    disabled={disabled}
                    aria-label={label}
                    aria-pressed={isActive}
                    aria-disabled={disabled}
                    onClick={() => handleServiceChange(service)}
                    className={`relative mx-auto w-[40%] max-w-full overflow-hidden rounded-[2rem] border-0 bg-transparent p-0 transition-shadow duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange sm:rounded-[2.35rem] ${
                      disabled ? "cursor-not-allowed opacity-45 shadow-none" : "cursor-pointer hover:opacity-[0.97]"
                    } ${
                      disabled
                        ? ""
                        : isActive
                          ? activeGlowClass
                          : SERVICE_TYPE_BUTTON_SHADOW_IDLE[service]
                    } `}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- static assets in public/button */}
                    <img
                      src={buttonArtSrc}
                      alt=""
                      width={512}
                      height={512}
                      draggable={false}
                      className="pointer-events-none h-auto w-full select-none object-contain"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {!showDecoratedServiceFlow && renderRealtimeTotalPricePanel(true)}

          {showDecoratedServiceFlow && (
            <>
              <div className="space-y-3">
                <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
                  4. Placement Selector
                </h2>
                {activeDealPackage ? (
                  <p className="text-[1.02rem] text-brand-navy/70">
                    This deal includes one logo on the <strong>left chest (LC)</strong> only.
                  </p>
                ) : null}
                <div className="grid gap-2 overflow-visible">
                  {placementOptionsForUi.map((option) => {
                    const assignedService = placementAssignments[option.id] ?? null;
                    const diagramSrc = placementLogoLocationSrc(option.id, option.label, {
                      diagramAbbr: option.diagramAbbr,
                    });
                    const rowSelectedClass =
                      assignedService === "Embroidery"
                        ? "bg-brand-orange/10"
                        : assignedService === "Printing"
                          ? "bg-blue-100"
                          : "";

                    return (
                      <div
                        key={`combined-${option.id}`}
                        className={`grid grid-cols-3 items-center gap-2 overflow-visible rounded-xl px-3 py-3 transition sm:gap-3 sm:px-4 ${rowSelectedClass}`}
                      >
                        <div className="flex min-w-0 items-center gap-2 overflow-visible sm:gap-3">
                          {diagramSrc ? (
                            <span className="relative shrink-0 overflow-visible">
                              {/* eslint-disable-next-line @next/next/no-img-element -- small static public asset */}
                              <img
                                src={diagramSrc}
                                alt=""
                                className="relative z-0 h-14 w-14 origin-center rounded-lg border border-brand-navy/10 bg-white object-contain shadow-sm transition-[transform,box-shadow] duration-300 ease-out will-change-transform hover:z-[80] hover:scale-[3] hover:shadow-2xl hover:ring-2 hover:ring-brand-navy/20 sm:h-16 sm:w-16"
                              />
                            </span>
                          ) : (
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-white">
                              <PlacementIcon className="h-4 w-4" />
                            </span>
                          )}
                          <span className="min-w-0 text-[1.26rem] font-semibold">
                            {option.label} <span className="text-brand-navy/50">({option.short})</span>
                          </span>
                        </div>
                        {/* Column 2 aligns with Embroidery icon */}
                        {isEmbroiderySelected ? (
                          isEmbroideryOfferedForPlacement(option.diagramAbbr) ? (
                            <button
                              type="button"
                              onClick={() => assignPlacement(option.id, "Embroidery")}
                              className={`mx-auto w-[72%] max-w-full whitespace-nowrap rounded-md border px-2.5 py-1 text-[1.08rem] font-medium transition sm:px-3 sm:text-[1.26rem] ${
                                assignedService === "Embroidery"
                                  ? "border-brand-orange bg-brand-orange text-brand-navy"
                                  : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange"
                              }`}
                            >
                              {activeDealPackage ? "Emb" : `Emb +${toCurrencyExact(option.embroideryCost)}`}
                            </button>
                          ) : (
                            <span
                              className="inline-flex mx-auto w-[72%] max-w-full items-center justify-center border-none bg-transparent p-0 text-[1.08rem] font-medium tabular-nums text-brand-navy/40 shadow-none ring-0 sm:text-[1.26rem]"
                              aria-label="Embroidery not available for this placement"
                            >
                              -
                            </span>
                          )
                        ) : (
                          <span className="block" aria-hidden />
                        )}
                        {/* Column 3 aligns with Printing icon */}
                        {isPrintingSelected ? (
                          <button
                            type="button"
                            onClick={() => assignPlacement(option.id, "Printing")}
                            className={`mx-auto w-[72%] max-w-full whitespace-nowrap rounded-md border px-2.5 py-1 text-[1.08rem] font-medium transition sm:px-3 sm:text-[1.26rem] ${
                              assignedService === "Printing"
                                ? "border-blue-600 bg-blue-500 text-white"
                                : "border-brand-navy/20 bg-white text-brand-navy hover:border-blue-500 hover:text-blue-600"
                            }`}
                          >
                            {activeDealPackage ? "Print" : `Print +${toCurrencyExact(option.printingCost)}`}
                          </button>
                        ) : (
                          <span className="block" aria-hidden />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
                  5. Logo Upload
                </h2>
                <label
                  htmlFor="logo-upload"
                  onDragEnter={onLogoZoneDragEnter}
                  onDragLeave={onLogoZoneDragLeave}
                  onDragOver={onLogoZoneDragOver}
                  onDrop={onLogoZoneDrop}
                  className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-brand-surface px-5 py-6 text-center transition sm:min-h-[150px] sm:px-6 sm:py-8 ${
                    logoDropActive
                      ? "border-brand-orange bg-brand-orange/5"
                      : "border-brand-navy/25 hover:border-brand-orange"
                  }`}
                >
                  <input
                    ref={logoInputRef}
                    id="logo-upload"
                    type="file"
                    className="sr-only"
                    multiple
                    accept="image/*,.pdf,.ai,application/pdf,application/postscript"
                    onChange={(e) => appendLogoFiles(e.target.files)}
                  />
                  <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-navy/10 text-brand-navy">
                    <UploadIcon />
                  </span>
                  <p className="text-[1.26rem] font-medium sm:text-[1.44rem]">Drag and drop logo files here</p>
                  <p className="mt-1 text-[1.08rem] text-brand-navy/70 sm:text-[1.26rem]">
                    or click to browse from your device
                  </p>
                  <p className="mt-3 text-[1.08rem] font-semibold tracking-wide text-brand-orange">
                    All image formats (JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, HEIC/HEIF, and more) plus PDF and Adobe
                    Illustrator (AI)
                  </p>
                  <p className="mt-2 max-w-md text-[0.95rem] leading-snug text-brand-navy/55">
                    {activeDealPackage
                      ? `This deal includes ${activeDealPackage.maxLogos} logo file. ${Math.round(MAX_LOGO_BYTES / (1024 * 1024))} MB max.`
                      : `Up to ${MAX_LOGO_FILES} files, ${Math.round(MAX_LOGO_BYTES / (1024 * 1024))} MB each.`}{" "}
                    Names are saved on the cart line when you add to cart (binary files stay in this browser until
                    checkout).
                  </p>
                </label>
                {logoAttachments.length > 0 ? (
                  <ul className="space-y-2 rounded-xl border border-brand-navy/10 bg-white p-3">
                    {logoAttachments.map((row) => (
                      <li
                        key={row.key}
                        className="flex items-center gap-3 rounded-lg border border-brand-navy/10 bg-brand-surface/60 px-2 py-2"
                      >
                        {row.previewUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={row.previewUrl}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-md border border-brand-navy/10 bg-white object-contain"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-brand-navy/15 bg-white text-[0.65rem] font-semibold uppercase text-brand-navy/70">
                            File
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-[1.05rem] text-brand-navy">{row.file.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeLogoAttachment(row.key);
                          }}
                          className="shrink-0 rounded-md border border-brand-navy/20 px-2 py-1 text-[0.95rem] font-semibold text-brand-navy hover:border-brand-orange hover:text-brand-orange"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="space-y-3">
                <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
                  6. NOTE
                </h2>
                <label htmlFor="order-notes" className="sr-only">
                  Order notes and requirements
                </label>
                <textarea
                  id="order-notes"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  placeholder="Write any special requirements, logo colours, or other notes for this order."
                  className="w-full resize-y rounded-2xl border border-brand-navy/15 bg-white px-4 py-3 text-[1.26rem] text-brand-navy placeholder:text-brand-navy/45 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                />
                <p className="text-[1.08rem] text-brand-navy/55">
                  {orderNotes.length} / 2000 characters
                </p>
              </div>

              {renderRealtimeTotalPricePanel(false)}
            </>
          )}
        </section>
      </div>
        </section>
      </div>
      <SizeGuideDialog
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        bundle={sizeGuideBundle}
        downloadSlug={sizeGuideDownloadSlug}
        externalLinks={supplierSizeChartLinks}
      />
      <HeroImageLightbox
        open={heroLightboxOpen}
        onClose={() => setHeroLightboxOpen(false)}
        src={activeImage}
        alt={heroAlt}
      />
    </main>
  );
}

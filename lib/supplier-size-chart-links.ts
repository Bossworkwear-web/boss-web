/**
 * Optional brand / supplier size-chart URLs for the PDP dialog and .txt download.
 * Edit this list when suppliers publish new PDFs or pages — no schema migration required.
 */

import {
  isBizCareCatalogProduct,
  isFashionBizChefLineListing,
  isYesChefCatalogProduct,
  type WorkwearOnlyBrandMeta,
} from "@/lib/product-visibility";

export type SupplierSizeChartLink = {
  label: string;
  href: string;
};

/** Fashion Biz group size guide (Biz Collection, Biz Care, Yes!Chef, etc.). */
export const FASHION_BIZ_SIZE_GUIDE_URL = "https://www.fashionbiz.com.au/size-guide";

const BIZ_COLLECTION_SIZE_GUIDE_LINK: SupplierSizeChartLink = {
  label: "Biz Collection — size guide",
  href: FASHION_BIZ_SIZE_GUIDE_URL,
};

/** Syzmik brand size guide (Fashion Biz group). */
export const SYZMIK_SIZE_GUIDE_URL = "https://www.syzmik.com/size-guide";

/** JB's Wear sizing specifications. */
export const JBS_WEAR_SIZE_GUIDE_URL = "https://www.jbswear.com.au/general/sizing-specifications";

/** Bisley Workwear size chart. */
export const BISLEY_SIZE_GUIDE_URL = "https://www.bisleyworkwear.com.au/bisley-workwear-size-chart/";

function isBisleyListing(blob: string, slug: string): boolean {
  if (blob.includes("bisley") || /\bbisley\b/.test(slug)) {
    return true;
  }
  return slug.startsWith("bis-");
}

function isJbsWearListing(blob: string, slug: string): boolean {
  if (
    blob.includes("jb's wear") ||
    blob.includes("jbs wear") ||
    blob.includes("jbswear") ||
    /\bjbs\s*wear\b/.test(blob)
  ) {
    return true;
  }
  return slug.startsWith("jb-") || slug.includes("jbswear");
}

function pack(
  productName: string,
  storeSlug?: string | null,
  supplierName?: string | null,
  category?: string | null,
): string {
  return `${productName} ${storeSlug ?? ""} ${supplierName ?? ""} ${category ?? ""}`.toLowerCase();
}

function listingMeta(
  storeSlug?: string | null,
  supplierName?: string | null,
  category?: string | null,
): Pick<WorkwearOnlyBrandMeta, "slug" | "supplier_name" | "category"> {
  return {
    slug: storeSlug ?? null,
    supplier_name: supplierName ?? null,
    category: category ?? null,
  };
}

function isBizCareSizeGuideListing(
  productName: string,
  blob: string,
  slug: string,
  meta: Pick<WorkwearOnlyBrandMeta, "slug" | "supplier_name" | "category">,
): boolean {
  return isBizCareCatalogProduct(productName, meta) || blob.includes("biz care") || slug.includes("bizcare");
}

function isYesChefSizeGuideListing(
  productName: string,
  blob: string,
  slug: string,
  storeSlug: string | null | undefined,
  meta: Pick<WorkwearOnlyBrandMeta, "slug" | "supplier_name" | "category">,
): boolean {
  return (
    isYesChefCatalogProduct(productName, meta) ||
    isFashionBizChefLineListing(productName, storeSlug) ||
    blob.includes("yes chef") ||
    slug.includes("yeschef")
  );
}

/**
 * Resolve public “official” or brand-catalog size pages from product name and store slug.
 * Uses https where the host supports it.
 */
export function resolveSupplierSizeChartLinks(
  productName: string,
  storeSlug?: string | null,
  supplierName?: string | null,
  category?: string | null,
): SupplierSizeChartLink[] {
  const blob = pack(productName, storeSlug, supplierName, category);
  const slug = String(storeSlug ?? "").toLowerCase();
  const meta = listingMeta(storeSlug, supplierName, category);

  if (blob.includes("syzmik") || slug.includes("syzmik")) {
    return [{ label: "Syzmik — size guide", href: SYZMIK_SIZE_GUIDE_URL }];
  }
  if (blob.includes("biz collection") || slug.includes("bizcollection")) {
    return [BIZ_COLLECTION_SIZE_GUIDE_LINK];
  }
  if (isBizCareSizeGuideListing(productName, blob, slug, meta)) {
    return [BIZ_COLLECTION_SIZE_GUIDE_LINK];
  }
  if (isYesChefSizeGuideListing(productName, blob, slug, storeSlug, meta)) {
    return [BIZ_COLLECTION_SIZE_GUIDE_LINK];
  }
  if (isJbsWearListing(blob, slug)) {
    return [{ label: "JB — size guide", href: JBS_WEAR_SIZE_GUIDE_URL }];
  }
  if (isBisleyListing(blob, slug)) {
    return [{ label: "Bisley — size guide", href: BISLEY_SIZE_GUIDE_URL }];
  }

  return [];
}

export function appendSupplierLinksToPlainText(
  body: string,
  links: SupplierSizeChartLink[],
): string {
  if (!links.length) {
    return body;
  }
  const lines = links.map((l) => `${l.label}\n${l.href}`);
  return `${body.trim()}\n\n---\nSupplier size charts (open in browser)\n\n${lines.join("\n\n")}\n`;
}

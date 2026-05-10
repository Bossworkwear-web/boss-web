import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import { isYesChefCatalogProduct, type WorkwearOnlyBrandMeta } from "@/lib/product-visibility";

/** Chip label to hide on Yes Chef `CH234M` PDP (sync duplicate / non-shoppable row). */
export function isYesChefCh234mExcludedColourChip(label: string): boolean {
  const t = String(label).trim().toLowerCase().replace(/\s+/g, " ");
  return t === "black white check";
}

export function isStorefrontYesChefCh234mPdp(
  productName: string,
  meta?: Pick<WorkwearOnlyBrandMeta, "slug" | "category" | "description" | "supplier_name"> | WorkwearOnlyBrandMeta | null,
): boolean {
  if (!isYesChefCatalogProduct(productName, meta ?? undefined)) {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, meta?.slug ?? null);
  if (!code) {
    return false;
  }
  const base = code.toUpperCase().replace(/-CLEARANCE$/i, "");
  return base === "CH234M";
}

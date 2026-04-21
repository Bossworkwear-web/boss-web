import { BIZ_CARE_MISCELLANEOUS_SKUS_UPPER } from "@/lib/biz-care-misc-skus.generated";
import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";

/** @deprecated Use `fashionBizStyleCodeFromListing` (still resolves Biz Care–only paths the same). */
export const bizCareListingStyleCode = fashionBizStyleCodeFromListing;

export function isBizCareListingInMiscGeneratedSet(productName: string, storeSlug?: string | null): boolean {
  if (!productName.toLowerCase().includes("biz care")) {
    return false;
  }
  const code = fashionBizStyleCodeFromListing(productName, storeSlug);
  return Boolean(code && BIZ_CARE_MISCELLANEOUS_SKUS_UPPER.has(code));
}

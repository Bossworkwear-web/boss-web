import { dncStyleCodeFromListing, isDncWorkwearSupplierMeta } from "@/lib/dnc-glove-routing";

type DncSafetySpecListingMeta = {
  slug?: string | null;
  category?: string | null;
  supplier_name?: string | null;
  description?: string | null;
};

const DNC_SAFETY_SPEC_SLUG_RE = /^dnc-(?:sp|p130|p300|p670|p900|p920)/i;

/** DNC `SP*` safety-spectacle families and legacy `P130` / `P670` / … spec style codes. */
export function isDncSafetySpecStyleCode(styleCode: string | null | undefined): boolean {
  const code = String(styleCode ?? "").trim().toUpperCase();
  if (!code) {
    return false;
  }
  if (/^SP\d+/.test(code)) {
    return true;
  }
  if (/^P130/.test(code) || /^P300/.test(code) || /^P670/.test(code) || /^P900/.test(code) || /^P920/.test(code)) {
    return true;
  }
  return false;
}

function dncListingLooksLikeSafetySpec(productName: string): boolean {
  const n = String(productName ?? "").toLowerCase();
  return (
    /\bsafety\s*spec\b/.test(n) ||
    /\bvisitor\s*spec\b/.test(n) ||
    /\bvistors\s*spec\b/.test(n) ||
    /\bspectacle\b/.test(n) ||
    /\bspec\s+clear\b/.test(n) ||
    /\bspec\s+smoke\b/.test(n)
  );
}

/**
 * DNC safety spectacles / spec accessories — PPE → Safty Glasses only (never Workwear browse).
 */
export function isDncPpeSafetyGlassesExclusiveListing(
  productName: string,
  meta?: DncSafetySpecListingMeta,
): boolean {
  if (!isDncWorkwearSupplierMeta(meta)) {
    return false;
  }
  const slug = String(meta?.slug ?? "").trim().toLowerCase();
  if (DNC_SAFETY_SPEC_SLUG_RE.test(slug)) {
    return true;
  }
  const cat = String(meta?.category ?? "").trim().toLowerCase();
  if (cat === "safty glasses" || cat === "safety glasses") {
    return dncListingLooksLikeSafetySpec(productName) || isDncSafetySpecStyleCode(dncStyleCodeFromListing(productName, meta?.slug));
  }
  const code = dncStyleCodeFromListing(productName, meta?.slug);
  if (isDncSafetySpecStyleCode(code)) {
    return true;
  }
  return dncListingLooksLikeSafetySpec(productName);
}

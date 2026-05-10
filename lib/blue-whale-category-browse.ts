import { resolveProductSubSlug } from "@/lib/product-subslug";

/** Minimal fields for Blue Whale storefront routing (avoids importing `product-visibility`). */
export type BlueWhaleBrowseMeta = {
  slug?: string | null;
  category?: string | null;
  description?: string | null;
  supplier_name?: string | null;
};

function isBlueWhaleSupplierName(supplierName: string | null | undefined): boolean {
  const s = String(supplierName ?? "").trim().toLowerCase();
  return s === "blue whale" || /\bblue\s*whale\b/.test(s);
}

/** True when this listing is a Blue Whale catalog row (supplier or `Blue Whale …` name prefix). */
export function isBlueWhaleCatalogRow(productName: string, meta?: BlueWhaleBrowseMeta | null): boolean {
  return (
    isBlueWhaleSupplierName(meta?.supplier_name ?? null) || /^\s*blue\s*whale\b/i.test(productName.trim())
  );
}

function blueWhaleTrailingStyleCodeUpper(productName: string): string | null {
  const m = String(productName).trim().match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/);
  return m ? m[1].toUpperCase().replace(/-CLEARANCE$/i, "") : null;
}

/** F81 / F82 — keep forcing Workwear/Jumper before other workwear browse remaps (see `resolveWorkwearCategoryBrowseSubSlug`). */
export function isBlueWhaleF81F82WorkwearJumperExclusiveListing(
  productName: string,
  meta?: BlueWhaleBrowseMeta | null,
): boolean {
  if (!isBlueWhaleCatalogRow(productName, meta)) {
    return false;
  }
  const tail = blueWhaleTrailingStyleCodeUpper(productName);
  if (tail === "F81" || tail === "F82") {
    return true;
  }
  const slug = String(meta?.slug ?? "").toLowerCase();
  return (
    slug.includes("blue-whale") &&
    (/(?:^|-)f81(?:-|$)/.test(slug) || /(?:^|-)f82(?:-|$)/.test(slug))
  );
}

/**
 * When non-null, this row must appear only under **Workwear** at this sub slug
 * (Polos / Jumper / Pants / Shirts / T-shirts / Jackets / … — same as `resolveProductSubSlug`).
 */
export function blueWhaleWorkwearExclusiveExpectedSubSlug(
  productName: string,
  meta?: BlueWhaleBrowseMeta | null,
): string | null {
  if (!isBlueWhaleCatalogRow(productName, meta)) {
    return null;
  }
  return resolveProductSubSlug(
    productName,
    meta?.category ?? null,
    meta?.slug ?? null,
    meta?.description ?? null,
  );
}

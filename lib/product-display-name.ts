/**
 * Storefront-only: strip leading supplier brand from `products.name` (`Brand SKU` rows).
 * Routing / `resolveProductSubSlug` / sync still use the full DB `name`.
 */
const STOREFRONT_BRAND_PREFIXES: RegExp[] = [
  /^Biz Collection\s+/i,
  /^Biz Care\s+/i,
  /^Syzmik\s+/i,
  /^Yes Chef\s+/i,
  /^Bisley\s+/i,
  /^Blue Whale\s+/i,
  /^Blue-Whale\s+/i,
  /^JB'?s\s+Wear\s+/i,
];

/** Leading supplier brand from `products.name` (e.g. `Syzmik ZH145` → `Syzmik`). */
const LEADING_SUPPLIER_BRAND_LABELS: { re: RegExp; label: string }[] = [
  { re: /^Biz Collection\s+/i, label: "Biz Collection" },
  { re: /^Biz Care\s+/i, label: "Biz Care" },
  { re: /^Syzmik\s+/i, label: "Syzmik" },
  { re: /^Yes Chef\s+/i, label: "Yes Chef" },
  { re: /^Bisley\s+/i, label: "Bisley" },
  { re: /^Blue Whale\s+/i, label: "Blue Whale" },
  { re: /^Blue-Whale\s+/i, label: "Blue Whale" },
  { re: /^JB'?s\s+Wear\s+/i, label: "JB's Wear" },
];

export function storefrontLeadingSupplierBrand(name: string): string | null {
  const s = name.trim();
  if (!s) {
    return null;
  }
  for (const { re, label } of LEADING_SUPPLIER_BRAND_LABELS) {
    if (re.test(s)) {
      return label;
    }
  }
  return null;
}

export function storefrontProductNameWithoutBrand(name: string): string {
  let s = name.trim();
  if (!s) {
    return name;
  }
  for (const re of STOREFRONT_BRAND_PREFIXES) {
    s = s.replace(re, "").trim();
  }
  return s.length > 0 ? s : name.trim();
}

/** Phrases inside CSV marketing titles / copy (e.g. "Unisex Biz Care Tote Bag"). */
const EMBEDDED_SUPPLIER_PHRASES: RegExp[] = [
  /\bBiz\s+Care\b/gi,
  /\bBiz\s+Collection\b/gi,
  /\bFashion\s+Biz\b/gi,
  /\bFashionBiz\b/gi,
];

/**
 * Full storefront cleanup: leading `Brand SKU` prefix + embedded supplier/company names in the string.
 */
export function storefrontStripSupplierBranding(text: string): string {
  const raw = text.trim();
  if (!raw) {
    return text;
  }
  let s = storefrontProductNameWithoutBrand(raw);
  for (const re of EMBEDDED_SUPPLIER_PHRASES) {
    s = s.replace(re, " ");
  }
  s = s.replace(/\s+/g, " ").trim();
  return s.length > 0 ? s : raw;
}

/** Product page `description`: strip supplier branding on each line (cards). */
export function storefrontDescriptionForDisplay(description: string): string {
  return description
    .split(/\r?\n/)
    .map((line) => storefrontStripSupplierBranding(line))
    .join("\n");
}

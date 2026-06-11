type DncGloveListingMeta = {
  slug?: string | null;
  category?: string | null;
  supplier_name?: string | null;
  description?: string | null;
};

/** DNC catalogue style families that are always PPE → Glove (GC/GL/GM/GN/GP/GR…). */
const DNC_GLOVE_STYLE_PREFIX_RE = /^G[CGLMNPR]/i;

const DNC_GLOVE_EXTRA_SLUGS = new Set([
  "dnc-p3dg",
  "dnc-pcdb10283",
  "dnc-pcgl41b360",
  "dnc-ppgl41",
]);

export function isDncWorkwearSupplierMeta(
  meta?: Pick<DncGloveListingMeta, "supplier_name" | "slug"> | null,
): boolean {
  const sup = String(meta?.supplier_name ?? "").trim().toLowerCase();
  if (sup === "dnc workwear" || sup === "dnc") {
    return true;
  }
  return String(meta?.slug ?? "").trim().toLowerCase().startsWith("dnc-");
}

export function dncStyleCodeFromListing(
  productName: string,
  slug?: string | null,
): string | null {
  const slugLc = String(slug ?? "").trim().toLowerCase();
  const fromSlug = /^dnc-([a-z0-9]+)$/i.exec(slugLc);
  if (fromSlug?.[1]) {
    return fromSlug[1].toUpperCase();
  }
  const m = String(productName).trim().match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/);
  return m?.[1] ? m[1].toUpperCase() : null;
}

export function isDncGloveStyleCode(styleCode: string | null | undefined): boolean {
  const code = String(styleCode ?? "").trim().toUpperCase();
  return code.length > 0 && DNC_GLOVE_STYLE_PREFIX_RE.test(code);
}

/**
 * DNC rows that must appear only under PPE → Glove (never Workwear / Men's / … browse grids).
 * Includes glove clips, liners, coated gloves, riggers, etc. (DNC `G*` style families).
 */
export function isDncPpeGloveExclusiveListing(
  productName: string,
  meta?: DncGloveListingMeta,
): boolean {
  if (!isDncWorkwearSupplierMeta(meta)) {
    return false;
  }
  const slug = String(meta?.slug ?? "").trim().toLowerCase();
  if (DNC_GLOVE_EXTRA_SLUGS.has(slug)) {
    return true;
  }
  if (/^dnc-g[cglmnpgr]/i.test(slug)) {
    return true;
  }
  const cat = String(meta?.category ?? "").trim().toLowerCase();
  if (cat === "glove" || cat === "gloves") {
    return true;
  }
  const code = dncStyleCodeFromListing(productName, meta?.slug);
  return isDncGloveStyleCode(code);
}

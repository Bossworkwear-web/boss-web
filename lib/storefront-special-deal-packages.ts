/** Fixed storefront package deals (Special Deals page → product PDP → cart). */

export const C81_FIVE_PACK_DEAL_ID = "c81-5-pack" as const;
export const C81_TEN_PACK_DEAL_ID = "c81-10-pack" as const;
export const C91_FIVE_PACK_DEAL_ID = "c91-5-pack" as const;
export const C91_TEN_PACK_DEAL_ID = "c91-10-pack" as const;
export const SPP7_FIVE_PACK_DEAL_ID = "7spp-5-pack" as const;
export const SPP7_TEN_PACK_DEAL_ID = "7spp-10-pack" as const;

export type StorefrontSpecialDealPackageId =
  | typeof C81_FIVE_PACK_DEAL_ID
  | typeof C81_TEN_PACK_DEAL_ID
  | typeof C91_FIVE_PACK_DEAL_ID
  | typeof C91_TEN_PACK_DEAL_ID
  | typeof SPP7_FIVE_PACK_DEAL_ID
  | typeof SPP7_TEN_PACK_DEAL_ID;

export type StorefrontSpecialDealPackage = {
  id: StorefrontSpecialDealPackageId;
  /** `products.slug` segment for `/products/[slug]`. */
  productSlug: string;
  styleCode: string;
  units: number;
  maxLogos: number;
  maxPlacements: number;
  totalAud: number;
  imageSrc: string;
  badge: string;
  title: string;
  description: string;
  priceLabel: string;
};

function audLabel(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function packageDeal(input: {
  id: StorefrontSpecialDealPackageId;
  productSlug: string;
  styleCode: string;
  units: 5 | 10;
  totalAud: number;
  imageSrc: string;
  title: string;
}): StorefrontSpecialDealPackage {
  const badge = input.units === 5 ? "5-pack · 1 logo" : "10-pack · 1 logo";
  const total = input.totalAud;
  return {
    id: input.id,
    productSlug: input.productSlug,
    styleCode: input.styleCode,
    units: input.units,
    maxLogos: 1,
    maxPlacements: 1,
    totalAud: total,
    imageSrc: input.imageSrc,
    badge,
    title: input.title,
    description: `Buy ${input.units} with logo print or embroidery — ${audLabel(total)} total.`,
    priceLabel: audLabel(total),
  };
}

export const C81_FIVE_PACK_DEAL: StorefrontSpecialDealPackage = packageDeal({
  id: C81_FIVE_PACK_DEAL_ID,
  productSlug: "bw-c81",
  styleCode: "C81",
  units: 5,
  totalAud: 200,
  imageSrc: "/special-deals/c81-5-pack.jpg",
  title: "C81 Hi-Vis Work Shirt",
});

export const C81_TEN_PACK_DEAL: StorefrontSpecialDealPackage = packageDeal({
  id: C81_TEN_PACK_DEAL_ID,
  productSlug: "bw-c81",
  styleCode: "C81",
  units: 10,
  totalAud: 360,
  imageSrc: "/C81_10_package.jpg",
  title: "C81 Hi-Vis Work Shirt",
});

export const C91_FIVE_PACK_DEAL: StorefrontSpecialDealPackage = packageDeal({
  id: C91_FIVE_PACK_DEAL_ID,
  productSlug: "bw-c91",
  styleCode: "C91",
  units: 5,
  totalAud: 250,
  imageSrc: "/C91_5_package.jpg",
  title: "C91 Hi-Vis Day/Night Shirt",
});

export const C91_TEN_PACK_DEAL: StorefrontSpecialDealPackage = packageDeal({
  id: C91_TEN_PACK_DEAL_ID,
  productSlug: "bw-c91",
  styleCode: "C91",
  units: 10,
  totalAud: 460,
  imageSrc: "/C91_10_package.jpg",
  title: "C91 Hi-Vis Day/Night Shirt",
});

export const SPP7_FIVE_PACK_DEAL: StorefrontSpecialDealPackage = packageDeal({
  id: SPP7_FIVE_PACK_DEAL_ID,
  productSlug: "jb-7spp",
  styleCode: "7SPP",
  units: 5,
  totalAud: 165,
  imageSrc: "/7SPP_5_package.jpg",
  title: "7SPP Work Polo",
});

export const SPP7_TEN_PACK_DEAL: StorefrontSpecialDealPackage = packageDeal({
  id: SPP7_TEN_PACK_DEAL_ID,
  productSlug: "jb-7spp",
  styleCode: "7SPP",
  units: 10,
  totalAud: 300,
  imageSrc: "/7SPP_10_Package.jpg",
  title: "7SPP Work Polo",
});

export const STOREFRONT_SPECIAL_DEAL_PACKAGES: StorefrontSpecialDealPackage[] = [
  C81_FIVE_PACK_DEAL,
  C81_TEN_PACK_DEAL,
  C91_FIVE_PACK_DEAL,
  C91_TEN_PACK_DEAL,
  SPP7_FIVE_PACK_DEAL,
  SPP7_TEN_PACK_DEAL,
];

export function getStorefrontSpecialDealPackageById(
  id: string | null | undefined,
): StorefrontSpecialDealPackage | null {
  const key = (id ?? "").trim();
  if (!key) return null;
  return STOREFRONT_SPECIAL_DEAL_PACKAGES.find((p) => p.id === key) ?? null;
}

export function specialDealPackageProductHref(pkg: StorefrontSpecialDealPackage): string {
  return `/products/${encodeURIComponent(pkg.productSlug)}?deal=${encodeURIComponent(pkg.id)}`;
}

export function productMatchesSpecialDealPackage(
  product: { slug?: string | null; displayProductCode?: string | null; name?: string | null },
  pkg: StorefrontSpecialDealPackage,
): boolean {
  const slug = (product.slug ?? "").trim().toLowerCase();
  const targetSlug = pkg.productSlug.trim().toLowerCase();
  const code = (product.displayProductCode ?? "").trim().toUpperCase();
  const style = pkg.styleCode.trim().toUpperCase();
  if (slug === targetSlug) return true;
  if (code === style) return true;
  const name = (product.name ?? "").toUpperCase();
  if (!name.includes(style)) return false;
  if (name.includes("BLUE WHALE")) return true;
  if (targetSlug.startsWith("jb-") && slug.startsWith("jb-")) return true;
  return false;
}

export function resolveActiveSpecialDealPackageForProduct(
  dealParam: string | null | undefined,
  product: { slug?: string | null; displayProductCode?: string | null; name?: string | null },
): StorefrontSpecialDealPackage | null {
  const pkg = getStorefrontSpecialDealPackageById(dealParam);
  if (!pkg) return null;
  if (!productMatchesSpecialDealPackage(product, pkg)) return null;
  return pkg;
}

/** Package deals: logo placement is left chest (LC) only. */
export function isLeftChestPlacementOption(option: {
  diagramAbbr: string;
  label: string;
  short?: string;
  id?: string;
}): boolean {
  const abbr = option.diagramAbbr.trim().toUpperCase();
  if (abbr === "LC") return true;
  const short = (option.short ?? "").trim().toUpperCase();
  if (short === "LC") return true;
  const id = (option.id ?? "").trim().toLowerCase();
  if (id === "left-chest" || id === "left_chest") return true;
  const label = option.label.trim().toLowerCase();
  return label === "left chest" || label.startsWith("left chest");
}

export function filterPlacementsForSpecialDealPackage<T extends {
  diagramAbbr: string;
  label: string;
  short?: string;
  id?: string;
}>(options: readonly T[]): T[] {
  return options.filter(isLeftChestPlacementOption);
}

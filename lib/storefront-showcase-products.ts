import type { StoreProduct } from "@/app/components/product-showcase";
import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";
import { storefrontRetailFromSupplierBase } from "@/lib/product-price";
import { productPathSegment } from "@/lib/product-path-slug";
import { hasStorefrontListNameAndPrice, isProductEligibleForSiteSearch } from "@/lib/product-visibility";

function inferCategory(name: string): StoreProduct["category"] {
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

const fallbackProducts: StoreProduct[] = [
  {
    id: "fallback-1",
    slug: "t-shirt",
    storeSlug: null,
    name: "T-shirt",
    category: "T-shirts",
    priceLabel: "$99.00",
    embroideryAvailable: true,
  },
  {
    id: "fallback-2",
    slug: "polo",
    storeSlug: null,
    name: "Polo",
    category: "Polos",
    priceLabel: "$99.00",
    embroideryAvailable: true,
  },
  {
    id: "fallback-3",
    slug: "work-shirt",
    storeSlug: null,
    name: "Work shirt",
    category: "Work Shirts",
    priceLabel: "$99.00",
    embroideryAvailable: true,
  },
  {
    id: "fallback-4",
    slug: "scrub",
    storeSlug: null,
    name: "Scrub",
    category: "Scrubs",
    priceLabel: "$99.00",
    embroideryAvailable: true,
  },
];

/** Active storefront rows mapped for home / search grids (same source as category browse cache). */
export async function getStorefrontShowcaseProducts(): Promise<StoreProduct[]> {
  try {
    const data = await getCachedActiveProductsBrowseRows();

    if (!data?.length) {
      return fallbackProducts;
    }

    return data
      .filter(
        (item) =>
          hasStorefrontListNameAndPrice(item.name, item.base_price) &&
          isProductEligibleForSiteSearch(item.name, {
            slug: item.slug,
            category: item.category,
            storefront_hidden: (item as { storefront_hidden?: boolean | null }).storefront_hidden ?? null,
          }),
      )
      .map((item) => {
        const dbCat = typeof item.category === "string" ? item.category.trim() : "";
        return {
          id: item.id,
          slug: productPathSegment({ name: item.name, slug: item.slug }),
          storeSlug: typeof item.slug === "string" && item.slug.trim().length > 0 ? item.slug.trim() : null,
          name: item.name,
          category: dbCat.length > 0 ? dbCat : inferCategory(item.name),
          description: typeof item.description === "string" ? item.description : null,
          imageUrls: Array.isArray(item.image_urls) ? item.image_urls : null,
          basePrice: item.base_price,
          priceLabel: (() => {
            const p = storefrontRetailFromSupplierBase(item.base_price);
            return p != null ? `$${p.toFixed(2)}` : "";
          })(),
          embroideryAvailable: true,
          supplierName: item.supplier_name ?? null,
          availableColors: item.available_colors ?? null,
          availableSizes: item.available_sizes ?? null,
        };
      });
  } catch {
    return fallbackProducts;
  }
}

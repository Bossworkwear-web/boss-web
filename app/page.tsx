import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeCompanyIntro } from "@/app/components/home-company-intro";
import { HomeHero } from "@/app/components/home-hero";
import { ProductShowcase, type StoreProduct } from "@/app/components/product-showcase";
import { TopNav } from "@/app/components/top-nav";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { getMainCategory } from "@/lib/catalog";
import { hasStorefrontListNameAndPrice, isProductEligibleForSiteSearch } from "@/lib/product-visibility";
import { storefrontRetailFromSupplierBase } from "@/lib/product-price";
import { productPathSegment } from "@/lib/product-path-slug";
import { productMatchesSearchQuery } from "@/lib/product-search";
import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const categoryParam = (params.category ?? "").trim();
  if (q) {
    return {
      robots: { index: false, follow: true },
      description: `Product search: ${q}`,
    };
  }
  if (categoryParam) {
    return {
      robots: { index: false, follow: true },
    };
  }
  return {
    alternates: { canonical: "/" },
  };
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

async function getProducts(): Promise<StoreProduct[]> {
  try {
    const data = await getCachedActiveProductsBrowseRows();

    if (!data?.length) {
      return fallbackProducts;
    }

    return data
      .filter((item) =>
        hasStorefrontListNameAndPrice(item.name, item.base_price) &&
        isProductEligibleForSiteSearch(item.name, {
          slug: item.slug,
          category: item.category,
          storefront_hidden: (item as { storefront_hidden?: boolean | null }).storefront_hidden ?? null,
        }),
      )
      .map((item) => ({
        id: item.id,
        slug: productPathSegment({ name: item.name, slug: item.slug }),
        storeSlug: typeof item.slug === "string" && item.slug.trim().length > 0 ? item.slug.trim() : null,
        name: item.name,
        category: inferCategory(item.name),
        priceLabel: (() => {
          const p = storefrontRetailFromSupplierBase(item.base_price);
          return p != null ? `$${p.toFixed(2)}` : "";
        })(),
        embroideryAvailable: true,
      }));
  } catch {
    return fallbackProducts;
  }
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const categoryParam = (params.category ?? "").trim();
  if (categoryParam && getMainCategory(categoryParam)) {
    redirect(`/categories/${encodeURIComponent(categoryParam)}`);
  }

  const products = await getProducts();
  const query = (params.q ?? "").trim().toLowerCase();
  const filteredProducts = query
    ? products.filter((item) =>
        productMatchesSearchQuery(item.name, item.storeSlug ?? item.slug, item.category, query),
      )
    : products;

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <MainWithSupplierRail>
        <TopNav />
        <HomeHero />
        <HomeCompanyIntro />
        <section className="bg-white pt-[1.5cm]">
          <div className="mx-auto flex w-full max-w-[120rem] flex-col items-center px-4 pb-2 sm:px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/BossWW_image.jpg"
              alt="Boss WW"
              className="h-[7cm] w-[7cm] rounded-2xl object-cover"
              loading="eager"
              decoding="async"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/supplier_logo_1.jpg"
              alt="Supplier logo"
              className="mt-[1.5cm] h-auto w-[21cm] max-w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>
        <ProductShowcase
          hideTopNav
          products={filteredProducts}
          initialSearchQuery={(params.q ?? "").trim()}
        />
      </MainWithSupplierRail>
    </main>
  );
}

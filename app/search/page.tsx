import type { Metadata } from "next";

import { ProductShowcase } from "@/app/components/product-showcase";
import { TopNav } from "@/app/components/top-nav";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { getStorefrontShowcaseProducts } from "@/lib/storefront-showcase-products";
import { firstQueryString } from "@/lib/url-search-params-string";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const q = firstQueryString((await searchParams).q);
  if (q) {
    return {
      title: `Search: ${q}`,
      robots: { index: false, follow: true },
      description: `Product search results for ${q}`,
    };
  }
  return {
    title: "Search",
    alternates: { canonical: "/search" },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const qRaw = firstQueryString((await searchParams).q);
  const products = await getStorefrontShowcaseProducts();

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <MainWithSupplierRail>
        <TopNav />
        <ProductShowcase
          hideTopNav
          products={products}
          initialSearchQuery={qRaw}
          layout="search"
        />
      </MainWithSupplierRail>
    </main>
  );
}

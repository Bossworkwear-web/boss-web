import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeCompanyIntro } from "@/app/components/home-company-intro";
import { HomeHero } from "@/app/components/home-hero";
import { ProductShowcase } from "@/app/components/product-showcase";
import { TopNav } from "@/app/components/top-nav";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { getMainCategory } from "@/lib/catalog";
import { getStorefrontShowcaseProducts } from "@/lib/storefront-showcase-products";
import { firstQueryString } from "@/lib/url-search-params-string";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const params = await searchParams;
  const q = firstQueryString(params.q);
  const categoryParam = firstQueryString(params.category);
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

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const queryRaw = firstQueryString(params.q);
  if (queryRaw) {
    redirect(`/search?q=${encodeURIComponent(queryRaw)}`);
  }

  const categoryParam = firstQueryString(params.category);
  if (categoryParam && getMainCategory(categoryParam)) {
    redirect(`/categories/${encodeURIComponent(categoryParam)}`);
  }

  const products = await getStorefrontShowcaseProducts();

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
        <ProductShowcase hideTopNav products={products} initialSearchQuery="" layout="home" />
      </MainWithSupplierRail>
    </main>
  );
}

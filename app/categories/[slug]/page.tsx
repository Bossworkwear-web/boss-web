import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { CategoryBrowseInteractive } from "@/app/components/category-browse-interactive";
import { CategoryBrowseTitle } from "@/app/components/category-browse-title";
import { CategorySubcategoryPicker } from "@/app/components/category-subcategory-picker";
import { CategoryGetAQuoteCta } from "@/app/components/category-get-a-quote-cta";
import { JsonLd } from "@/app/components/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { QuoteGuideModal } from "@/app/components/quote-guide-modal";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { ChefCategoryTopAd } from "@/app/components/chef-category-top-ad";
import { HealthCareCategoryTopAd } from "@/app/components/health-care-category-top-ad";
import { KidsCategoryTopAd } from "@/app/components/kids-category-top-ad";
import { MensCategoryTopAd } from "@/app/components/mens-category-top-ad";
import { PpeCategoryTopAd } from "@/app/components/ppe-category-top-ad";
import { WomensCategoryTopAd } from "@/app/components/womens-category-top-ad";
import { WorkwearCategoryTopAd } from "@/app/components/workwear-category-top-ad";
import { getMainCategory, getSubCategoriesForMain, HEALTH_CARE_MAIN_SLUG } from "@/lib/catalog";
import { STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

/** Static category shell; product grid filters client-side from `/api/storefront/browse-catalog`. */
export const revalidate = 3600;

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const main = getMainCategory(slug);
  const label = main?.label ?? "Workwear";
  const title = `${label} Workwear & Uniforms`.replace(/workwear workwear/i, "Workwear");
  const description = `Shop ${label} workwear, uniforms and PPE at Boss Workwear — logo embroidery & printing, bulk discounts and Australia-wide shipping. Buy online or request a free quote.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/categories/${slug}`,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/categories/${slug}`,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  const legacyToMain: Record<string, string> = {
    "t-shirts": "mens",
    polos: "mens",
    shirts: "mens",
    "work-shirts": "mens",
    scrubs: HEALTH_CARE_MAIN_SLUG,
  };
  if (legacyToMain[slug]) {
    redirect(`/categories/${legacyToMain[slug]}`);
  }

  const main = getMainCategory(slug);

  if (!main) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: main.label, url: `/categories/${slug}` },
        ])}
      />
      <TopNav />
      <QuoteGuideModal />
      <MainWithSupplierRail>
        {slug === "workwear" ? <WorkwearCategoryTopAd /> : null}
        {slug === "mens" ? <MensCategoryTopAd /> : null}
        {slug === "womens" ? <WomensCategoryTopAd /> : null}
        {slug === "kids" ? <KidsCategoryTopAd /> : null}
        {slug === HEALTH_CARE_MAIN_SLUG ? <HealthCareCategoryTopAd /> : null}
        {slug === "ppe" ? <PpeCategoryTopAd /> : null}
        {slug === "chef" ? <ChefCategoryTopAd /> : null}
        <CategoryGetAQuoteCta />
        <section className={`category-browse-panel relative z-10 ${SITE_PAGE_ROW_CLASS} pb-10 pt-0`}>
          <header data-cyber-guide="cat-header" className="mb-7 mt-10 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">Category</p>
            <CategoryBrowseTitle>{main.label}</CategoryBrowseTitle>
            <div className="space-y-1.5">
              <p className="text-sm text-brand-navy/65">Choose a product to continue to the product page.</p>
              <p className="text-sm text-brand-navy/55">
                Prices include {Math.round(STOREFRONT_RETAIL_GST_RATE * 100)}% GST.
              </p>
            </div>
          </header>

          <div data-cyber-guide="cat-subcategories">
            <CategorySubcategoryPicker
              mainSlug={slug}
              mainLabel={main.label}
              subs={getSubCategoriesForMain(slug)}
            />
          </div>

          <Suspense fallback={null}>
            <CategoryBrowseInteractive mainSlug={slug} />
          </Suspense>
        </section>
      </MainWithSupplierRail>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { CategoryBrowseInteractive } from "@/app/components/category-browse-interactive";
import { CategoryBrowseTitle } from "@/app/components/category-browse-title";
import { CategorySubcategoryPicker } from "@/app/components/category-subcategory-picker";
import { CategoryGetAQuoteCta } from "@/app/components/category-get-a-quote-cta";
import { QuoteGuideModal } from "@/app/components/quote-guide-modal";
import { JsonLd } from "@/app/components/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { ChefCategoryTopAd } from "@/app/components/chef-category-top-ad";
import { HealthCareCategoryTopAd } from "@/app/components/health-care-category-top-ad";
import { KidsCategoryTopAd } from "@/app/components/kids-category-top-ad";
import { MensCategoryTopAd } from "@/app/components/mens-category-top-ad";
import { PpeCategoryTopAd } from "@/app/components/ppe-category-top-ad";
import { WomensCategoryTopAd } from "@/app/components/womens-category-top-ad";
import { WorkwearCategoryTopAd } from "@/app/components/workwear-category-top-ad";
import { getMainCategory, getSubCategoriesForMain, HEALTH_CARE_MAIN_SLUG, SUB_CATEGORIES } from "@/lib/catalog";
import { STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

/** Static subcategory shell; product grid filters client-side from cached browse catalog. */
export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string; subSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, subSlug } = await params;
  const subsForMeta = getSubCategoriesForMain(slug);
  const subLabel =
    subsForMeta.find((s) => s.slug === subSlug)?.label ??
    SUB_CATEGORIES.find((s) => s.slug === subSlug)?.label ??
    subSlug;
  const main = getMainCategory(slug);
  const title = main ? `${main.label} ${subLabel}` : subLabel;
  const scope = main ? `${main.label} ${subLabel}` : subLabel;
  const description = `Shop ${scope} at Boss Workwear — workwear and uniforms with logo embroidery & printing, bulk discounts and Australia-wide shipping. Buy online or request a free quote.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/categories/${slug}/${subSlug}`,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/categories/${slug}/${subSlug}`,
    },
  };
}

export default async function SubCategoryBrowsePage({ params }: Props) {
  const { slug, subSlug } = await params;

  if (subSlug !== subSlug.toLowerCase()) {
    redirect(`/categories/${slug}/${subSlug.toLowerCase()}`);
  }

  if (slug === "workwear") {
    const alias: Record<string, string> = {
      jumpers: "jumper",
      misc: "miscellaneous",
    };
    const mapped = alias[subSlug];
    if (mapped) {
      redirect(`/categories/${slug}/${mapped}`);
    }
  }

  if ((slug === "mens" || slug === "womens") && (subSlug === "chef" || subSlug === "apron")) {
    redirect(subSlug === "apron" ? "/categories/chef/apron" : "/categories/chef/miscellaneous");
  }

  if ((slug === "mens" || slug === "womens") && subSlug === "scrubs") {
    redirect("/categories/health-care/tops");
  }

  if (slug === "chef") {
    const alias: Record<string, string> = {
      jacket: "jackets",
      pant: "pants",
      aprons: "apron",
      misc: "miscellaneous",
    };
    const mapped = alias[subSlug];
    if (mapped) {
      redirect(`/categories/${slug}/${mapped}`);
    }
  }

  if (slug === "ppe" && subSlug === "hi-vis-vest") {
    redirect("/categories/ppe/miscellaneous");
  }

  const legacyToMain: Record<string, string> = {
    "t-shirts": "mens",
    polos: "mens",
    shirts: "mens",
    "work-shirts": "mens",
    scrubs: HEALTH_CARE_MAIN_SLUG,
  };
  if (legacyToMain[slug]) {
    redirect(`/categories/${legacyToMain[slug]}/${subSlug}`);
  }

  const main = getMainCategory(slug);
  if (!main) {
    notFound();
  }

  const subsForMain = getSubCategoriesForMain(slug);
  const subMeta =
    subsForMain.find((s) => s.slug === subSlug) ??
    (slug === "workwear" && subSlug === "jumper" ? { slug: "jumper", label: "Jumper" } : undefined);
  if (!subMeta) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: main.label, url: `/categories/${slug}` },
          { name: subMeta.label, url: `/categories/${slug}/${subSlug}` },
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
            <CategoryBrowseTitle>
              {main.label}
              <span className="text-brand-navy/50"> / </span>
              {subMeta.label}
            </CategoryBrowseTitle>
            <div className="space-y-1.5">
              <p className="text-sm text-brand-navy/65">
                <Link href={`/categories/${slug}`} className="font-semibold text-brand-orange hover:underline">
                  All {main.label}
                </Link>
                <span className="text-brand-navy/55"> · </span>
                Choose a product to open its product page.
              </p>
              <p className="text-sm text-brand-navy/55">
                Prices include {Math.round(STOREFRONT_RETAIL_GST_RATE * 100)}% GST.
              </p>
            </div>
          </header>

          <div data-cyber-guide="cat-subcategories">
            <CategorySubcategoryPicker
              mainSlug={slug}
              mainLabel={main.label}
              subs={subsForMain}
              activeSubSlug={subMeta.slug}
            />
          </div>

          <Suspense fallback={null}>
            <CategoryBrowseInteractive mainSlug={slug} subSlug={subSlug} />
          </Suspense>
        </section>
      </MainWithSupplierRail>
    </main>
  );
}

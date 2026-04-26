import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CategoryBrowseTitle } from "@/app/components/category-browse-title";
import { CategoryBrandFilter } from "@/app/components/category-brand-filter";
import { CategoryGetAQuoteCta } from "@/app/components/category-get-a-quote-cta";
import { ProductGridPriceCells } from "@/app/components/product-grid-price";
import { ProductNavLink } from "@/app/components/product-nav-link";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { WorkwearCategoryTopAd } from "@/app/components/workwear-category-top-ad";
import { categoryBrowseCardImageUrl } from "@/lib/category-browse-card-image";
import { getDiscountPercent } from "@/lib/discounts";
import { getMainCategory, HEALTH_CARE_MAIN_SLUG } from "@/lib/catalog";
import {
  CATEGORY_BROWSE_PAGE_SIZE,
  filterProductsForMainCategoryBrowse,
  resolveChefCategoryBrowseSubSlug,
  type CategoryBrowseProductRow,
} from "@/lib/main-category-browse";
import {
  hasStorefrontListNameAndPrice,
  isJbWearSixSeriesListing,
  isJbWorkwearExcludedHeadwearOrSocks,
} from "@/lib/product-visibility";
import { productCardDisplayLines } from "@/lib/product-card-copy";
import { productPathSegment } from "@/lib/product-path-slug";
import { resolveHealthCareBrowseSubSlug } from "@/lib/health-care-browse";
import { resolveProductSubSlug } from "@/lib/product-subslug";
import { storefrontRetailFromSupplierBase, STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";
import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";
import { PRODUCT_CARD_CODE_PRICE_SEPARATOR, productCardModelPriceRowStyle } from "@/lib/product-card-model-price-layout";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; brand?: string; sort?: string }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    alternates: {
      canonical: `/categories/${slug}`,
    },
  };
}

function pageHref(slug: string, page: number, brand?: string, sort?: string) {
  const base = `/categories/${slug}`;
  const params = new URLSearchParams();
  const b = String(brand ?? "").trim();
  if (b) {
    params.set("brand", b);
  }
  const s = String(sort ?? "").trim();
  if (s) {
    params.set("sort", s);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { page: pageParam, brand: brandParamRaw, sort: sortParamRaw } = await searchParams;

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

  const allRows = await getCachedActiveProductsBrowseRows();

  const inferredBrandForFilter = (item: {
    supplier_name?: string | null;
    name: string;
    slug?: string | null;
    description?: string | null;
  }) => {
    const hay = `${item.name} ${item.slug ?? ""} ${item.description ?? ""}`.toLowerCase();
    // Fashion Biz rows often keep a generic `supplier_name` while the listing name/slug says Syzmik/Bisley.
    if (hay.includes("syzmik")) {
      return "Syzmik";
    }
    if (hay.includes("bisley")) {
      return "Bisley";
    }
    const direct = String(item.supplier_name ?? "").trim();
    if (direct) {
      const lower = direct.toLowerCase();
      if (lower === "jb's wear" || lower === "jbs wear" || lower === "jbswear" || /\bjbs\s*wear\b/i.test(lower)) {
        return "JB's Wear";
      }
      return direct;
    }
    if (hay.includes("jb-") || hay.includes("jbs")) return "JB's Wear";
    return "";
  };

  const jbLooksHiVis = (item: { name: string; slug?: string | null; category?: string | null; description?: string | null }) => {
    const hay = `${item.name} ${item.slug ?? ""} ${item.category ?? ""} ${item.description ?? ""}`.toLowerCase();
    return /\bhv\b/.test(hay) || /\bhi[\s-]*vis\b/.test(hay) || /\bhigh[\s-]*vis\b/.test(hay);
  };

  const looksWorkwearKeywordListing = (item: {
    name: string;
    slug?: string | null;
    category?: string | null;
    description?: string | null;
  }) => {
    const hay = `${item.name} ${item.slug ?? ""} ${item.category ?? ""} ${item.description ?? ""}`.toLowerCase();
    return (
      /\bhv\b/.test(hay) ||
      /\bhi[\s-]*vis\b/.test(hay) ||
      /\bhigh[\s-]*vis\b/.test(hay) ||
      /\bwork\s*shirt\b/.test(hay) ||
      /\bwork\s*shirts?\b/.test(hay) ||
      /\breflective\b/.test(hay) ||
      /\brail\b/.test(hay) ||
      /\broad\b/.test(hay)
    );
  };

  const isWorkwearExclusiveBrand = (item: CategoryBrowseProductRow): boolean => {
    const b = inferredBrandForFilter(item).toLowerCase();
    if (b === "syzmik" || b === "bisley") {
      return true;
    }
    if (b === "jb's wear") {
      if (isJbWorkwearExcludedHeadwearOrSocks(item.name, { category: item.category ?? null })) {
        return false;
      }
      return (
        isJbWearSixSeriesListing(item.name, {
        slug: item.slug ?? null,
        supplier_name: item.supplier_name ?? null,
        }) || jbLooksHiVis(item)
      );
    }
    return looksWorkwearKeywordListing(item);
  };

  const baseRows =
    slug === "workwear"
      ? allRows.filter((item) => isWorkwearExclusiveBrand(item) && hasStorefrontListNameAndPrice(item.name, item.base_price))
      : filterProductsForMainCategoryBrowse(slug, allRows).filter(
          // Hard guard: Bisley + Syzmik should never appear outside Workwear,
          // even if upstream heuristics change.
          (item) => !isWorkwearExclusiveBrand(item),
        );

  const filteredAllBrands = baseRows.sort((a, b) => a.name.localeCompare(b.name));

  const brandParam = String(brandParamRaw ?? "").trim();
  const sortParam = String(sortParamRaw ?? "").trim();
  const brandsForDropdown = (() => {
    const fromRows = new Set(
      filteredAllBrands.map((r) => inferredBrandForFilter(r)).filter((s) => s.length > 0),
    );
    if (slug === "workwear") {
      fromRows.add("JB's Wear");
    }
    return [...fromRows].sort((a, b) => a.localeCompare(b));
  })();

  // If the URL has a stale/invalid brand, ignore it (treat as "All brands")
  // so category pages never accidentally go empty.
  const brandParamEffective =
    brandParam.length > 0 && brandsForDropdown.includes(brandParam) ? brandParam : "";

  const brandFiltered =
    brandParamEffective.length > 0
      ? filteredAllBrands.filter((item) => {
          if (inferredBrandForFilter(item) !== brandParamEffective) {
            return false;
          }
          if (slug === "workwear" && brandParamEffective === "JB's Wear") {
            if (isJbWorkwearExcludedHeadwearOrSocks(item.name, { category: item.category ?? null })) {
              return false;
            }
            return isJbWearSixSeriesListing(item.name, {
              slug: item.slug ?? null,
              supplier_name: item.supplier_name ?? null,
            });
          }
          return true;
        })
      : filteredAllBrands;

  const sortEffective = sortParam === "price-asc" || sortParam === "price-desc" ? sortParam : "";
  const sorted =
    sortEffective.length > 0
      ? [...brandFiltered].sort((a, b) => {
          const ap = storefrontRetailFromSupplierBase(a.base_price) ?? Number.POSITIVE_INFINITY;
          const bp = storefrontRetailFromSupplierBase(b.base_price) ?? Number.POSITIVE_INFINITY;
          if (ap !== bp) {
            return sortEffective === "price-asc" ? ap - bp : bp - ap;
          }
          return a.name.localeCompare(b.name);
        })
      : brandFiltered;

  const parsed = Number.parseInt(String(pageParam ?? "1"), 10);
  const requestedPage = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  const totalPages = Math.max(1, Math.ceil(sorted.length / CATEGORY_BROWSE_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * CATEGORY_BROWSE_PAGE_SIZE;
  const pageItems = sorted.slice(offset, offset + CATEGORY_BROWSE_PAGE_SIZE);

  const pageWindow = (() => {
    const maxButtons = 5;
    const count = Math.min(totalPages, maxButtons);
    const half = Math.floor(count / 2);
    let start = Math.max(1, currentPage - half);
    let end = start + count - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - count + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })();

  const matchAnySub = allRows.filter((item) => {
    const resolved = resolveProductSubSlug(item.name, item.category, item.slug, item.description);
    return resolved != null;
  });

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        {slug === "workwear" ? <WorkwearCategoryTopAd /> : null}
        <section className={`${SITE_PAGE_ROW_CLASS} py-10`}>
          <CategoryGetAQuoteCta />
          <header className="mb-7 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
              Category
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CategoryBrowseTitle>{main.label}</CategoryBrowseTitle>
              <CategoryBrandFilter brands={brandsForDropdown} />
            </div>
            <p className="text-sm text-brand-navy/65">
              Choose a product to continue to the product page.
            </p>
            <p className="text-sm text-brand-navy/55">
              Prices include {Math.round(STOREFRONT_RETAIL_GST_RATE * 100)}% GST.
            </p>
          </header>

          <div className="subcategory-browse-grid subcategory-browse-grid-gap grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5">
            {pageItems.map((item) => {
              const discountPercent = getDiscountPercent(item.name);
              const listPrice = storefrontRetailFromSupplierBase(item.base_price);
              const { productName, productCode } = productCardDisplayLines(
                item.name,
                item.description,
                item.slug,
                item.supplier_name ?? null,
                item.available_colors ?? null,
                true,
                item.available_sizes ?? null,
              );
              const resolvedSub =
                slug === "chef"
                  ? (resolveChefCategoryBrowseSubSlug(item) ?? "miscellaneous")
                  : slug === HEALTH_CARE_MAIN_SLUG
                    ? (resolveHealthCareBrowseSubSlug(item.name, {
                        slug: item.slug,
                        category: item.category,
                        description: item.description,
                      }) ?? "tops")
                    : resolveProductSubSlug(item.name, item.category, item.slug, item.description) ?? "t-shirts";
              const imageUrl = categoryBrowseCardImageUrl(item, resolvedSub);
              const imgAlt =
                productName != null && productName.length > 0
                  ? `${productName} (${productCode})`
                  : productCode;
              return (
                <ProductNavLink
                  key={item.id}
                  href={`/products/${encodeURIComponent(productPathSegment({ name: item.name, slug: item.slug }))}`}
                  mainSlug={slug}
                  subSlug={resolvedSub}
                  className="group flex w-full min-w-0 flex-col overflow-hidden rounded-[1.2rem] border border-brand-navy/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ minWidth: 0, width: "100%" }}
                >
                  <div className="subcategory-browse-card-media relative flex w-full shrink-0 items-center justify-center overflow-hidden border-b border-brand-navy/10 bg-white px-[0.9rem] py-[0.9rem]">
                    <img
                      src={imageUrl}
                      alt={imgAlt}
                      className="max-h-full max-w-full object-contain object-center"
                    />
                  </div>
                  <div className="subcategory-browse-card-body min-w-0 space-y-2 text-black">
                    {productName ? (
                      <h3 className="product-card-grid-title text-center font-medium text-brand-navy">
                        {productName}
                      </h3>
                    ) : null}
                    <div style={productCardModelPriceRowStyle}>
                      {productName ? (
                        <p className="product-card-grid-code m-0 p-0 font-light text-black">{productCode}</p>
                      ) : (
                        <h3 className="product-card-grid-title m-0 p-0 font-light text-black">{productCode}</h3>
                      )}
                      {listPrice != null ? (
                        <>
                          <span
                            className="select-none whitespace-pre text-brand-navy/45"
                            aria-hidden
                          >
                            {PRODUCT_CARD_CODE_PRICE_SEPARATOR}
                          </span>
                          <ProductGridPriceCells
                            listPrice={listPrice}
                            salePriceRaw={item.sale_price}
                            discountPercent={discountPercent}
                          />
                        </>
                      ) : null}
                    </div>
                  </div>
                </ProductNavLink>
              );
            })}
          </div>

          {totalPages > 1 && sorted.length > 0 ? (
            <nav
              className="mt-10 flex flex-wrap items-center justify-center gap-4 border-t border-brand-navy/10 pt-8 text-[1.05rem] leading-snug"
              aria-label="Product list pagination"
            >
              {currentPage > 1 ? (
                <Link
                  href={pageHref(slug, currentPage - 1, brandParamEffective, sortEffective)}
                  className="rounded-lg border border-brand-navy/20 px-4 py-2 font-semibold text-brand-navy transition hover:border-brand-orange hover:text-brand-orange"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-lg border border-transparent px-4 py-2 font-semibold text-brand-navy/35">
                  Previous
                </span>
              )}
              <div className="flex items-center gap-2">
                {pageWindow.map((p) =>
                  p === currentPage ? (
                    <span
                      key={p}
                      className="rounded-lg border border-brand-orange bg-brand-orange/10 px-3 py-2 font-semibold text-brand-orange"
                      aria-current="page"
                    >
                      {p}
                    </span>
                  ) : (
                    <Link
                      key={p}
                      href={pageHref(slug, p, brandParamEffective, sortEffective)}
                      className="rounded-lg border border-brand-navy/20 px-3 py-2 font-semibold text-brand-navy transition hover:border-brand-orange hover:text-brand-orange"
                    >
                      {p}
                    </Link>
                  ),
                )}
              </div>
              {currentPage < totalPages ? (
                <Link
                  href={pageHref(slug, currentPage + 1, brandParamEffective, sortEffective)}
                  className="rounded-lg border border-brand-navy/20 px-4 py-2 font-semibold text-brand-navy transition hover:border-brand-orange hover:text-brand-orange"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-lg border border-transparent px-4 py-2 font-semibold text-brand-navy/35">
                  Next
                </span>
              )}
            </nav>
          ) : null}

          {!brandFiltered.length ? (
            <div
              className="space-y-2 rounded-xl border border-brand-navy/10 bg-brand-surface px-4 py-4 text-sm text-brand-navy/80"
              role="status"
            >
              {matchAnySub.length === 0 ? (
                <p>
                  <span className="font-semibold text-brand-navy">Nothing mapped here.</span> No active
                  products are mapped into this category. Check catalog data or style-to-category rules.
                </p>
              ) : (
                <p>
                  <span className="font-semibold text-brand-navy">Nothing to list.</span> Products may be
                  hidden by storefront rules or need missing title/price. Try{" "}
                  <Link href="/search" className="font-semibold text-brand-orange hover:underline">
                    Search
                  </Link>
                  .
                </p>
              )}
            </div>
          ) : null}
        </section>
      </MainWithSupplierRail>
    </main>
  );
}

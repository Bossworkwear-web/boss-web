import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CategoryBrowseTitle } from "@/app/components/category-browse-title";
import { CategoryBrandFilter } from "@/app/components/category-brand-filter";
import { CategoryGetAQuoteCta } from "@/app/components/category-get-a-quote-cta";
import { ProductNavLink } from "@/app/components/product-nav-link";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { WorkwearCategoryTopAd } from "@/app/components/workwear-category-top-ad";
import { getDiscountPercent } from "@/lib/discounts";
import { fashionBizStyleCodeFromListing } from "@/lib/fashion-biz-style-code";
import { getMainCategory, getSubCategoriesForMain, SUB_CATEGORIES } from "@/lib/catalog";
import {
  CATEGORY_BROWSE_PAGE_SIZE,
  filterProductsForSubCategoryBrowse,
  resolveChefCategoryBrowseSubSlug,
  type CategoryBrowseProductRow,
} from "@/lib/main-category-browse";
import { productCardDisplayLines } from "@/lib/product-card-copy";
import { isJbWearSixSeriesListing, isJbWorkwearExcludedHeadwearOrSocks } from "@/lib/product-visibility";
import { productPathSegment } from "@/lib/product-path-slug";
import { resolveProductSubSlug } from "@/lib/product-subslug";
import { storefrontRetailFromSupplierBase, STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";
import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";
import {
  PRODUCT_CARD_CODE_PRICE_SEPARATOR,
  productCardModelPriceDiscountGroupStyle,
  productCardModelPriceRowStyle,
} from "@/lib/product-card-model-price-layout";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; subSlug: string }>;
  searchParams: Promise<{ page?: string; brand?: string }>;
};

const DEFAULT_IMAGE_BY_SUB: Record<string, string> = {
  "t-shirts": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80",
  polos: "https://images.unsplash.com/photo-1592878940526-0214b0f374f6?auto=format&fit=crop&w=1600&q=80",
  shirts: "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1600&q=80",
  "work-shirts": "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1600&q=80",
  jackets: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1600&q=80",
  jumper: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1600&q=80",
  pants: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1600&q=80",
  scrubs: "https://images.unsplash.com/photo-1612532275214-e4ca76d0e4d1?auto=format&fit=crop&w=1600&q=80",
  chef: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80",
  apron: "https://images.unsplash.com/photo-1604909052743-94e9cf232b2b?auto=format&fit=crop&w=1600&q=80",
  boots: "https://images.unsplash.com/photo-1542281286-9e0a16bb7368?auto=format&fit=crop&w=1600&q=80",
  glove: "https://images.unsplash.com/photo-1584735175097-719d848f8449?auto=format&fit=crop&w=1600&q=80",
  "safty-glasses": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=1600&q=80",
  "safety-glasses": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=1600&q=80",
  "head-wear":
    "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=1600&q=80",
  "hi-vis-vest":
    "https://images.unsplash.com/photo-1584308666744-24d5cfdc7ae8?auto=format&fit=crop&w=1600&q=80",
  miscellaneous:
    "https://images.unsplash.com/photo-1584308666744-24d5cfdc7ae8?auto=format&fit=crop&w=1600&q=80",
};

function heroOverrideCardImageUrl(item: CategoryBrowseProductRow): string | null {
  const code = fashionBizStyleCodeFromListing(item.name, item.slug ?? null);
  if (code?.toUpperCase() === "CL542UL") {
    const want = "CL542UL_TALENT_MIDNIGHTNAVY_07.JPG";
    const hit = (item.image_urls ?? []).find((u) => String(u).toUpperCase().includes(want));
    return hit?.trim() ? hit.trim() : null;
  }
  return null;
}

function subPageHref(mainSlug: string, subSlug: string, page: number, brand?: string, sort?: string) {
  const base = `/categories/${mainSlug}/${subSlug}`;
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, subSlug } = await params;
  const subLabel = SUB_CATEGORIES.find((s) => s.slug === subSlug)?.label ?? subSlug;
  const main = getMainCategory(slug);
  const title = main ? `${main.label} — ${subLabel}` : subLabel;
  return {
    title,
    alternates: {
      canonical: `/categories/${slug}/${subSlug}`,
    },
  };
}

export default async function SubCategoryBrowsePage({ params, searchParams }: Props) {
  const { slug, subSlug } = await params;
  const { page: pageParam, brand: brandParamRaw, sort: sortParamRaw } = await searchParams;

  // Normalize case (users often type `/Miscellaneous` etc). Next route params preserve case.
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

  // Chef aliases (users may type singular paths).
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
    scrubs: "mens",
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

  const allRows = await getCachedActiveProductsBrowseRows();

  const inferredBrandForFilter = (item: {
    supplier_name?: string | null;
    name: string;
    slug?: string | null;
    description?: string | null;
  }) => {
    const hay = `${item.name} ${item.slug ?? ""} ${item.description ?? ""}`.toLowerCase();
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

  const looksWorkwearShirtKeywords = (item: {
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
      /\breflective\b/.test(hay)
    );
  };

  const filteredAllBrands = filterProductsForSubCategoryBrowse(slug, subSlug, allRows)
    .filter((item) => {
      if (slug === "workwear") {
        const b = inferredBrandForFilter(item).toLowerCase();
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
        return true;
      }
      const sn = String(item.supplier_name ?? "").trim().toLowerCase();
      if (sn === "bisley" || sn === "syzmik") {
        return false;
      }
      const hay = `${item.name} ${item.slug ?? ""}`.toLowerCase();
      return !(hay.includes("bisley") || hay.includes("syzmik"));
    })
    .sort((a, b) => a.name.localeCompare(b.name));

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

  const brandParamEffective =
    brandParam.length > 0 && brandsForDropdown.includes(brandParam) ? brandParam : "";

  const filtered =
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
      ? [...filtered].sort((a, b) => {
          const ap = storefrontRetailFromSupplierBase(a.base_price) ?? Number.POSITIVE_INFINITY;
          const bp = storefrontRetailFromSupplierBase(b.base_price) ?? Number.POSITIVE_INFINITY;
          if (ap !== bp) {
            return sortEffective === "price-asc" ? ap - bp : bp - ap;
          }
          return a.name.localeCompare(b.name);
        })
      : filtered;

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
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">Category</p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CategoryBrowseTitle>
                {main.label}
                <span className="text-brand-navy/50"> / </span>
                {subMeta.label}
              </CategoryBrowseTitle>
              <CategoryBrandFilter brands={brandsForDropdown} />
            </div>
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
              );
              const resolvedSub =
                slug === "chef"
                  ? (resolveChefCategoryBrowseSubSlug(item) ?? subSlug)
                  : (resolveProductSubSlug(item.name, item.category, item.slug, item.description) ?? subSlug);
              const imageUrl =
                heroOverrideCardImageUrl(item) ??
                item.image_urls?.[0] ??
                DEFAULT_IMAGE_BY_SUB[resolvedSub] ??
                DEFAULT_IMAGE_BY_SUB["t-shirts"];
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
                          {discountPercent > 0 ? (
                            <span style={productCardModelPriceDiscountGroupStyle}>
                              <span className="product-card-grid-price-was font-light text-brand-navy/55 line-through">
                                ${listPrice.toFixed(2)}
                              </span>
                              <span className="product-card-grid-price-sale font-semibold text-red-600">
                                ${(listPrice * (1 - discountPercent / 100)).toFixed(2)}
                              </span>
                            </span>
                          ) : (
                            <span className="product-card-grid-price font-light">${listPrice.toFixed(2)}</span>
                          )}
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
                  href={subPageHref(slug, subSlug, currentPage - 1, brandParamEffective, sortEffective)}
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
                      href={subPageHref(slug, subSlug, p, brandParamEffective, sortEffective)}
                      className="rounded-lg border border-brand-navy/20 px-3 py-2 font-semibold text-brand-navy transition hover:border-brand-orange hover:text-brand-orange"
                    >
                      {p}
                    </Link>
                  ),
                )}
              </div>
              {currentPage < totalPages ? (
                <Link
                  href={subPageHref(slug, subSlug, currentPage + 1, brandParamEffective, sortEffective)}
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

          {!filtered.length ? (
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
                  <span className="font-semibold text-brand-navy">Nothing in this grouping yet.</span> Try{" "}
                  <Link href={`/categories/${slug}`} className="font-semibold text-brand-orange hover:underline">
                    all {main.label}
                  </Link>{" "}
                  or search from the home page.
                </p>
              )}
            </div>
          ) : null}
        </section>
      </MainWithSupplierRail>
    </main>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CategoryBrandFilter } from "@/app/components/category-brand-filter";
import { CategoryBrowseProductsGrid } from "@/app/components/category-browse-products-grid";
import { CategoryPaginationPageSummary } from "@/app/components/category-pagination-page-summary";
import { ProductGridPriceCells } from "@/app/components/product-grid-price";
import { ProductNavLink } from "@/app/components/product-nav-link";
import { categoryBrowseCardImageUrl } from "@/lib/category-browse-card-image";
import {
  buildMainCategoryBrowsePageView,
  buildSubCategoryBrowsePageView,
  categoryBrowsePageHref,
} from "@/lib/category-browse-page-view";
import { HEALTH_CARE_MAIN_SLUG } from "@/lib/catalog";
import { getDiscountPercent } from "@/lib/discounts";
import { resolveHealthCareBrowseSubSlug } from "@/lib/health-care-browse";
import {
  resolveChefCategoryBrowseSubSlug,
  type CategoryBrowseProductRow,
} from "@/lib/main-category-browse";
import { productCardDisplayLines } from "@/lib/product-card-copy";
import { PRODUCT_CARD_CODE_PRICE_SEPARATOR, productCardModelPriceRowStyle } from "@/lib/product-card-model-price-layout";
import { productPathSegment } from "@/lib/product-path-slug";
import { storefrontRetailFromSupplierBase, storefrontRetailProductMetaFromRow } from "@/lib/product-price";
import { resolveProductSubSlug } from "@/lib/product-subslug";
import { getStorefrontBrowseCatalogClient } from "@/lib/storefront-browse-catalog-client";

type Props = {
  mainSlug: string;
  subSlug?: string;
};

function GridSkeleton() {
  return (
    <CategoryBrowseProductsGrid>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="flex w-full min-w-0 flex-col overflow-hidden rounded-[1.2rem] border border-brand-navy/10 bg-white shadow-sm"
        >
          <div className="subcategory-browse-card-media relative flex w-full shrink-0 items-center justify-center overflow-hidden border-b border-brand-navy/10 bg-brand-surface/60 px-[0.9rem] py-[0.9rem]">
            <div className="aspect-square w-full max-w-[10rem] animate-pulse rounded-lg bg-brand-navy/8" />
          </div>
          <div className="subcategory-browse-card-body min-w-0 space-y-2 px-3 py-3">
            <div className="mx-auto h-4 w-4/5 animate-pulse rounded bg-brand-navy/8" />
            <div className="mx-auto h-3 w-3/5 animate-pulse rounded bg-brand-navy/6" />
          </div>
        </div>
      ))}
    </CategoryBrowseProductsGrid>
  );
}

function resolveCardSubSlug(
  mainSlug: string,
  subSlug: string | undefined,
  item: CategoryBrowseProductRow,
): string {
  if (mainSlug === "chef") {
    return resolveChefCategoryBrowseSubSlug(item) ?? subSlug ?? "miscellaneous";
  }
  if (mainSlug === HEALTH_CARE_MAIN_SLUG) {
    return (
      resolveHealthCareBrowseSubSlug(item.name, {
        slug: item.slug,
        category: item.category,
        description: item.description,
      }) ?? subSlug ?? "tops"
    );
  }
  return resolveProductSubSlug(item.name, item.category, item.slug, item.description) ?? subSlug ?? "t-shirts";
}

export function CategoryBrowseInteractive({ mainSlug, subSlug }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const brandParam = searchParams.get("brand");
  const sortParam = searchParams.get("sort");
  const pageParam = searchParams.get("page");

  const [catalogRows, setCatalogRows] = useState<CategoryBrowseProductRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getStorefrontBrowseCatalogClient()
      .then((rows) => {
        if (!cancelled) {
          setCatalogRows(rows);
          setLoadError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setCatalogRows([]);
          setLoadError(e instanceof Error ? e.message : "Catalog unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => {
    if (!catalogRows) {
      return null;
    }
    if (subSlug) {
      return buildSubCategoryBrowsePageView(mainSlug, subSlug, catalogRows, {
        brandParam,
        sortParam,
        pageParam,
      });
    }
    return buildMainCategoryBrowsePageView(mainSlug, catalogRows, {
      brandParam,
      sortParam,
      pageParam,
    });
  }, [catalogRows, mainSlug, subSlug, brandParam, sortParam, pageParam]);

  if (!catalogRows || !view) {
    return (
      <div id="category-products" className="space-y-6">
        <div className="flex justify-end">
          <div className="h-10 w-72 max-w-full animate-pulse rounded-lg bg-brand-navy/6" aria-hidden />
        </div>
        <GridSkeleton />
      </div>
    );
  }

  const {
    pageItems,
    brandsForDropdown,
    brandParamEffective,
    sortEffective,
    currentPage,
    totalPages,
    pageWindow,
    sortedCount,
    catalogHasMappedProducts,
  } = view;

  return (
    <div id="category-products" className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-4" data-cyber-guide="cat-brand-filter">
        <CategoryBrandFilter brands={brandsForDropdown} />
      </div>

      <CategoryBrowseProductsGrid>
        {pageItems.map((item) => {
          const discountPercent = getDiscountPercent(item.name);
          const listPrice = storefrontRetailFromSupplierBase(
            item.base_price,
            storefrontRetailProductMetaFromRow(item),
          );
          const { productName, productCode } = productCardDisplayLines(
            item.name,
            item.description,
            item.slug,
            item.supplier_name ?? null,
            item.available_colors ?? null,
            true,
            item.available_sizes ?? null,
          );
          const resolvedSub = resolveCardSubSlug(mainSlug, subSlug, item);
          const imageUrl = categoryBrowseCardImageUrl(item, resolvedSub);
          const imgAlt =
            productName != null && productName.length > 0 ? `${productName} (${productCode})` : productCode;
          return (
            <ProductNavLink
              key={item.id}
              href={`/products/${encodeURIComponent(productPathSegment({ name: item.name, slug: item.slug }))}`}
              mainSlug={mainSlug}
              subSlug={resolvedSub}
              className="group flex w-full min-w-0 flex-col overflow-hidden rounded-[1.2rem] border border-brand-navy/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              style={{ minWidth: 0, width: "100%" }}
            >
              <div className="subcategory-browse-card-media relative flex w-full shrink-0 items-center justify-center overflow-hidden border-b border-brand-navy/10 bg-white px-[0.9rem] py-[0.9rem]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={imgAlt} className="max-h-full max-w-full object-contain object-center" />
              </div>
              <div className="subcategory-browse-card-body min-w-0 space-y-2 text-black">
                {productName ? (
                  <h3 className="product-card-grid-title text-center font-medium text-brand-navy">{productName}</h3>
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
                        className="product-card-grid-separator select-none whitespace-pre text-brand-navy/45"
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
      </CategoryBrowseProductsGrid>

      {totalPages > 1 && sortedCount > 0 ? (
        <nav
          className="mt-4 w-full max-w-full min-w-0 border-t border-brand-navy/10 pt-8 text-[1.05rem] leading-snug"
          aria-label="Product list pagination"
        >
          <div
            data-cyber-guide="cat-pagination"
            className="flex w-full max-w-full min-w-0 flex-wrap items-center justify-center gap-4"
          >
            {currentPage > 1 ? (
              <Link
                href={categoryBrowsePageHref(pathname, currentPage - 1, brandParamEffective, sortEffective)}
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
                    href={categoryBrowsePageHref(pathname, p, brandParamEffective, sortEffective)}
                    className="rounded-lg border border-brand-navy/20 px-3 py-2 font-semibold text-brand-navy transition hover:border-brand-orange hover:text-brand-orange"
                  >
                    {p}
                  </Link>
                ),
              )}
            </div>
            {currentPage < totalPages ? (
              <Link
                href={categoryBrowsePageHref(pathname, currentPage + 1, brandParamEffective, sortEffective)}
                className="rounded-lg border border-brand-navy/20 px-4 py-2 font-semibold text-brand-navy transition hover:border-brand-orange hover:text-brand-orange"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-transparent px-4 py-2 font-semibold text-brand-navy/35">
                Next
              </span>
            )}
            <CategoryPaginationPageSummary currentPage={currentPage} totalPages={totalPages} />
          </div>
        </nav>
      ) : null}

      {!sortedCount ? (
        <div
          className="space-y-2 rounded-xl border border-brand-navy/10 bg-brand-surface px-4 py-4 text-sm text-brand-navy/80"
          role="status"
        >
          {loadError ? (
            <p>
              <span className="font-semibold text-brand-navy">Catalog unavailable.</span> {loadError}. If this
              persists, Supabase API keys on Vercel may need syncing — see{" "}
              <code className="rounded bg-white px-1">docs/SUPABASE_VERCEL_ENV.md</code>.
            </p>
          ) : catalogRows.length === 0 ? (
            <p>
              <span className="font-semibold text-brand-navy">Catalog unavailable.</span> The site could not load
              products from the database.
            </p>
          ) : !catalogHasMappedProducts ? (
            <p>
              <span className="font-semibold text-brand-navy">Nothing mapped here.</span> No active products are
              mapped into this category. Check catalog data or style-to-category rules.
            </p>
          ) : (
            <p>
              <span className="font-semibold text-brand-navy">Nothing to list.</span> Products may be hidden by
              storefront rules or need missing title/price. Try{" "}
              <Link href="/search" className="font-semibold text-brand-orange hover:underline">
                Search
              </Link>
              .
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

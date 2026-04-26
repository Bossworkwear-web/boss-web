"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRightIcon } from "@/app/components/icons";
import { ProductGridPriceCells } from "@/app/components/product-grid-price";
import { ProductNavLink } from "@/app/components/product-nav-link";
import { TopNavClient } from "@/app/components/top-nav-client";
import { categoryBrowseCardImageUrl } from "@/lib/category-browse-card-image";
import { getDiscountPercent } from "@/lib/discounts";
import { MAIN_CATEGORIES, type StorefrontNavSub } from "@/lib/catalog";
import { hasStorefrontListNameAndPrice, isProductEligibleForSiteSearch } from "@/lib/product-visibility";
import { storefrontRetailFromSupplierBase, STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";
import { productCardDisplayLines } from "@/lib/product-card-copy";
import { PRODUCT_CARD_CODE_PRICE_SEPARATOR, productCardModelPriceRowStyle } from "@/lib/product-card-model-price-layout";
import { productPathSegment } from "@/lib/product-path-slug";
import { productMatchesSearchQuery } from "@/lib/product-search";
import { resolveProductSubSlug } from "@/lib/product-subslug";
import { inferMainSlugForProduct } from "@/lib/sidebar-nav";
import { SITE_PAGE_INNER_SHELL_CLASS } from "@/lib/site-layout";
import { createSupabaseClient } from "@/lib/supabase";

export type StoreProduct = {
  id: string;
  /** URL segment for `/products/[slug]` */
  slug: string;
  /** Raw `products.slug` from DB (search / Fashion Biz paths) */
  storeSlug?: string | null;
  name: string;
  /** DB category (fallback coarse label) — used for search matching. */
  category: string;
  /** DB description — search only. */
  description?: string | null;
  imageUrls?: string[] | null;
  basePrice?: number | null;
  /** GST-inclusive storefront list price (before any discounts). */
  retailPrice?: number | null;
  /** Raw DB sale (GST incl.); cards use `ProductGridPriceCells` with list + this. */
  salePrice?: number | null;
  priceLabel: string;
  embroideryAvailable: boolean;
  supplierName?: string | null;
  availableColors?: string[] | null;
  availableSizes?: string[] | null;
};

type ProductShowcaseProps = {
  products: StoreProduct[];
  /** Server `searchParams.q`; avoids `useSearchParams` vs SSR mismatch on first paint. */
  initialSearchQuery?: string;
  /** When false, parent (e.g. home `page.tsx`) renders `TopNav` + `HomeHero` above this block. */
  hideTopNav?: boolean;
  /**
   * When `hideTopNav` is false, pass from a Server Component (`buildNavSubcategoriesByMain`) so sub-nav matches SSR.
   * Empty object falls back to client `getSubCategoriesForMain` (may diverge under HMR).
   */
  navSubsByMain?: Record<string, readonly StorefrontNavSub[]>;
  /** `home`: featured category grid when no query; `search`: dedicated `/search` page (no category grid). */
  layout?: "home" | "search";
};

type ProductRow = {
  id: string;
  name: string;
  base_price: number | null;
  sale_price?: number | null;
  slug?: string | null;
  category?: string | null;
  description?: string | null;
  image_urls?: string[] | null;
  storefront_hidden?: boolean | null;
  supplier_name?: string | null;
  available_colors?: string[] | null;
  available_sizes?: string[] | null;
};

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

/** Hero images for home “Shop by Category” — aligned with left-nav `MAIN_CATEGORIES`. */
const MAIN_CATEGORY_IMAGE_MAP: Record<string, string> = {
  workwear:
    "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=1600&q=80",
  mens: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80",
  womens:
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80",
  kids: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1600&q=80",
  "health-care":
    "https://images.unsplash.com/photo-1612532275214-e4ca76d0e4d1?auto=format&fit=crop&w=1600&q=80",
  ppe: "https://images.unsplash.com/photo-1581578731548-c64695d5ad77?auto=format&fit=crop&w=1600&q=80",
  "special-offer":
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80",
  clearance:
    "https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=1600&q=80",
};

/** Home category grid — matches `/service` imagery. */
const IN_STORE_SERVICE_CARD_IMAGE = "/service_Emb.png";

function toStoreProduct(item: ProductRow): StoreProduct {
  const raw = typeof item.slug === "string" && item.slug.trim().length > 0 ? item.slug.trim() : null;
  const dbCat = typeof item.category === "string" ? item.category.trim() : "";
  const retail = storefrontRetailFromSupplierBase(item.base_price);
  return {
    id: item.id,
    slug: productPathSegment({ name: item.name, slug: raw }),
    storeSlug: raw,
    name: item.name,
    category: dbCat.length > 0 ? dbCat : inferCategory(item.name),
    description: typeof item.description === "string" ? item.description : null,
    imageUrls: Array.isArray(item.image_urls) ? item.image_urls : null,
    basePrice: item.base_price,
    retailPrice: retail,
    salePrice: typeof item.sale_price === "number" ? item.sale_price : null,
    priceLabel: (() => {
      return retail != null ? `$${retail.toFixed(1)}` : "";
    })(),
    embroideryAvailable: true,
    supplierName: item.supplier_name ?? null,
    availableColors: item.available_colors ?? null,
    availableSizes: item.available_sizes ?? null,
  };
}

export function ProductShowcase({
  products,
  initialSearchQuery = "",
  hideTopNav = false,
  navSubsByMain = {},
  layout: layoutProp = "home",
}: ProductShowcaseProps) {
  const layout = layoutProp;
  const [liveProducts, setLiveProducts] = useState<StoreProduct[]>(products);
  const [q, setQ] = useState(() => initialSearchQuery.trim());

  useEffect(() => {
    setLiveProducts(products);
  }, [products]);

  useEffect(() => {
    setQ(initialSearchQuery.trim());
  }, [initialSearchQuery]);

  useEffect(() => {
    const onPopState = () => {
      setQ((new URLSearchParams(window.location.search).get("q") ?? "").trim());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let supabase: ReturnType<typeof createSupabaseClient>;
    try {
      supabase = createSupabaseClient();
    } catch {
      /* Missing NEXT_PUBLIC_SUPABASE_* — keep server-rendered product list, skip live updates */
      return;
    }

    let isMounted = true;
    const debounceMs = 450;
    type TTimer = ReturnType<typeof globalThis.setTimeout>;
    let debounceTimer: TTimer | null = null;

    const fetchProducts = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      /** Match server `getCachedActiveProductsBrowseRows`: active rows only + paginate past PostgREST's default max (~1000). */
      const select =
        "id, name, base_price, sale_price, slug, category, description, image_urls, storefront_hidden, supplier_name, available_colors, available_sizes";
      const pageSize = 1000;
      const maxScan = 25_000;
      const rows: ProductRow[] = [];
      for (let offset = 0; offset < maxScan; offset += pageSize) {
        const res = await supabase
          .from("products")
          .select(select)
          .eq("is_active", true)
          .order("name")
          .range(offset, offset + pageSize - 1);
        if (!isMounted || res.error || res.data == null) {
          return;
        }
        const chunk = res.data as ProductRow[];
        rows.push(...chunk);
        if (chunk.length < pageSize) {
          break;
        }
      }

      if (!isMounted) {
        return;
      }

      setLiveProducts(
        rows
          .filter((item) =>
            hasStorefrontListNameAndPrice((item as ProductRow).name, (item as ProductRow).base_price) &&
            isProductEligibleForSiteSearch((item as ProductRow).name, {
              slug: (item as ProductRow).slug,
              category: (item as ProductRow).category,
              storefront_hidden: (item as ProductRow).storefront_hidden ?? null,
            }),
          )
          .map((item) => toStoreProduct(item as ProductRow)),
      );
    };

    const scheduleFetch = () => {
      if (debounceTimer != null) {
        globalThis.clearTimeout(debounceTimer);
      }
      debounceTimer = globalThis.setTimeout(() => {
        debounceTimer = null;
        void fetchProducts();
      }, debounceMs);
    };

    void fetchProducts();

    const channel = supabase
      .channel("products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          scheduleFetch();
        },
      )
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchProducts();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      isMounted = false;
      if (debounceTimer != null) {
        globalThis.clearTimeout(debounceTimer);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, []);

  const searchMatches = useMemo(() => {
    if (!q.trim()) {
      return [];
    }
    return liveProducts
      .filter((p) =>
        productMatchesSearchQuery(p.name, p.storeSlug ?? p.slug, p.category, q, p.description, p.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [liveProducts, q]);

  const hasQuery = q.trim().length > 0;

  return (
    <>
      {hideTopNav ? null : <TopNavClient navSubsByMain={navSubsByMain} />}

      <section className={`${SITE_PAGE_INNER_SHELL_CLASS} py-12`}>
        {layout === "search" && !hasQuery ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">Search</p>
              <h1 className="text-3xl font-medium text-brand-navy">Find a product</h1>
              <p className="text-sm text-brand-navy/70">
                Enter a product name or style code (for example 7PIP, ZH145). You can also use the search box in
                the menu bar.
              </p>
            </div>
            <form
              action="/search"
              method="get"
              className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-stretch"
            >
              <input
                type="search"
                name="q"
                required
                placeholder="Name or style code"
                enterKeyHint="search"
                className="min-w-0 flex-1 rounded-full border border-brand-navy/20 bg-white px-4 py-2.5 text-base text-brand-navy placeholder:text-brand-navy/50 focus:border-brand-orange focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-brand-orange px-6 py-2.5 text-base font-semibold text-brand-navy transition hover:opacity-95"
              >
                Search
              </button>
            </form>
            <Link href="/" className="text-sm font-semibold text-brand-orange hover:underline">
              Back to home
            </Link>
          </div>
        ) : hasQuery ? (
          <>
            <div className="mb-7 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
                Search
              </p>
              {layout === "search" ? (
                <h1 className="text-3xl font-medium">Results for &ldquo;{q}&rdquo;</h1>
              ) : (
                <h2 className="text-3xl font-medium">Results for &ldquo;{q}&rdquo;</h2>
              )}
              <p className="text-sm text-brand-navy/65">
                {searchMatches.length} product{searchMatches.length === 1 ? "" : "s"} — by name or style
                code
              </p>
              <p className="text-sm text-brand-navy/55">
                Prices include {Math.round(STOREFRONT_RETAIL_GST_RATE * 100)}% GST.
              </p>
              {layout === "search" ? (
                <p className="text-xs text-brand-navy/55">
                  Browse{" "}
                  <Link href="/categories/workwear" className="font-medium text-brand-orange hover:underline">
                    store categories
                  </Link>{" "}
                  for a curated aisle, or try different keywords.
                </p>
              ) : (
                <p className="text-xs text-brand-navy/55">
                  With a search query, this list replaces the featured &ldquo;Shop by Category&rdquo; grid until
                  you clear the search box. Category URLs always use{" "}
                  <span className="font-medium text-brand-navy/70">/categories/…</span> (bookmark those for a
                  specific aisle).
                </p>
              )}
            </div>
            {searchMatches.length === 0 ? (
              <p className="rounded-2xl border border-brand-navy/10 bg-brand-surface px-6 py-10 text-center text-brand-navy/75">
                No products matched. Try another name or style code (e.g. ZH145, SG319M).
              </p>
            ) : layout === "search" ? (
              <div className="subcategory-browse-grid subcategory-browse-grid-gap grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5">
                {searchMatches.map((p) => {
                  const discountPercent = getDiscountPercent(p.name);
                  // Avoid hydration mismatch: use server-supplied retailPrice/label instead of recomputing price in render.
                  const listPrice =
                    p.retailPrice ??
                    (() => {
                      const raw = (p.priceLabel ?? "").trim();
                      if (!raw) return null;
                      const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
                      return Number.isFinite(n) ? n : null;
                    })();
                  const { productName, productCode } = productCardDisplayLines(
                    p.name,
                    p.description ?? undefined,
                    p.storeSlug ?? null,
                    p.supplierName ?? null,
                    p.availableColors ?? null,
                    true,
                    p.availableSizes ?? null,
                  );
                  const resolvedSub =
                    resolveProductSubSlug(p.name, p.category, p.storeSlug ?? null, p.description ?? null) ??
                    "t-shirts";
                  const mainSlug = inferMainSlugForProduct(p.name, resolvedSub, {
                    slug: p.storeSlug ?? null,
                    category: p.category,
                    supplier_name: p.supplierName ?? null,
                    description: p.description ?? null,
                  });
                  const imageUrl = categoryBrowseCardImageUrl(
                    { name: p.name, slug: p.storeSlug ?? null, image_urls: p.imageUrls ?? null },
                    resolvedSub,
                  );
                  const imgAlt =
                    productName != null && productName.length > 0
                      ? `${productName} (${productCode})`
                      : productCode;
                  return (
                    <ProductNavLink
                      key={p.id}
                      href={`/products/${encodeURIComponent(p.slug)}`}
                      mainSlug={mainSlug}
                      subSlug={resolvedSub}
                      className="group flex w-full min-w-0 flex-col overflow-hidden rounded-[1.2rem] border border-brand-navy/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                      style={{ minWidth: 0, width: "100%" }}
                    >
                      <div className="subcategory-browse-card-media relative flex w-full shrink-0 items-center justify-center overflow-hidden border-b border-brand-navy/10 bg-white px-[0.9rem] py-[0.9rem]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                                salePriceRaw={p.salePrice}
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
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchMatches.map((p) => {
                  const { productName, productCode } = productCardDisplayLines(
                    p.name,
                    undefined,
                    p.storeSlug ?? null,
                    p.supplierName ?? null,
                    p.availableColors ?? null,
                    true,
                    p.availableSizes ?? null,
                  );
                  return (
                    <li key={p.id} className="min-w-0">
                      <Link
                        href={`/products/${encodeURIComponent(p.slug)}`}
                        className="flex min-w-0 flex-col items-stretch rounded-2xl border border-brand-navy/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-orange/40 hover:shadow-md"
                        style={{ minWidth: 0, width: "100%" }}
                      >
                        {productName ? (
                          <span className="product-card-grid-title w-full text-center font-medium text-brand-navy">
                            {productName}
                          </span>
                        ) : null}
                        <div style={{ ...productCardModelPriceRowStyle, marginTop: "0.25rem" }}>
                          {productName ? (
                            <span className="product-card-grid-code font-light text-black">{productCode}</span>
                          ) : (
                            <span className="product-card-grid-title font-light text-black">{productCode}</span>
                          )}
                          {p.retailPrice != null ? (
                            <>
                              <span
                                className="select-none whitespace-pre text-brand-navy/45"
                                aria-hidden
                              >
                                {PRODUCT_CARD_CODE_PRICE_SEPARATOR}
                              </span>
                              <ProductGridPriceCells
                                listPrice={p.retailPrice}
                                salePriceRaw={p.salePrice}
                                discountPercent={getDiscountPercent(p.name)}
                              />
                            </>
                          ) : null}
                        </div>
                        <span className="mt-3 flex w-full items-center justify-center gap-1 text-sm font-semibold text-brand-orange">
                          View product
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <>
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <p className="text-[1.4625rem] font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
                  Featured Range
                </p>
                <h2 className="text-[3.65625rem] font-medium leading-tight">Shop by Category</h2>
              </div>
              <p className="text-[1.70625rem] font-semibold text-brand-orange">
                {MAIN_CATEGORIES.length + 1} categories
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {MAIN_CATEGORIES.map((main) => {
                const imageSrc =
                  MAIN_CATEGORY_IMAGE_MAP[main.slug] ?? MAIN_CATEGORY_IMAGE_MAP.workwear;
                return (
                  <article
                    key={main.slug}
                    className="group overflow-hidden rounded-2xl border border-brand-navy/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div
                      className="h-44 w-full bg-cover bg-center"
                      style={{
                        backgroundImage: `linear-gradient(0deg, rgba(0,31,63,0.2), rgba(0,31,63,0.2)), url("${imageSrc}")`,
                      }}
                    />

                    <div className="flex flex-row items-center justify-between gap-[0.6rem] p-[2.73rem] sm:gap-[0.8rem]">
                      <p className="min-w-0 flex-1 truncate text-left text-[1.638rem] font-semibold uppercase leading-snug tracking-[0.1em] text-brand-navy/65">
                        {main.label}
                      </p>
                      <Link
                        href={`/categories/${main.slug}`}
                        className="inline-flex shrink-0 items-center gap-[0.2796rem] rounded-lg border border-brand-navy/20 px-[1.0483rem] py-[0.5242rem] text-[1.223rem] font-semibold leading-none transition group-hover:border-brand-orange group-hover:text-brand-orange"
                      >
                        Select
                        <ArrowRightIcon className="h-[1.223rem] w-[1.223rem] shrink-0" />
                      </Link>
                    </div>
                  </article>
                );
              })}
              <article
                key="in-store-service"
                className="group overflow-hidden rounded-2xl border border-brand-navy/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div
                  className="h-44 w-full bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(0deg, rgba(0,31,63,0.2), rgba(0,31,63,0.2)), url("${IN_STORE_SERVICE_CARD_IMAGE}")`,
                  }}
                />

                <div className="flex flex-row items-center justify-between gap-[0.6rem] p-[2.73rem] sm:gap-[0.8rem]">
                  <p className="min-w-0 flex-1 truncate text-left text-[1.638rem] font-semibold uppercase leading-snug tracking-[0.1em] text-brand-navy/65">
                    In Store Service
                  </p>
                  <Link
                    href="/service"
                    className="inline-flex shrink-0 items-center gap-[0.2796rem] rounded-lg border border-brand-navy/20 px-[1.0483rem] py-[0.5242rem] text-[1.223rem] font-semibold leading-none transition group-hover:border-brand-orange group-hover:text-brand-orange"
                  >
                    Select
                    <ArrowRightIcon className="h-[1.223rem] w-[1.223rem] shrink-0" />
                  </Link>
                </div>
              </article>
            </div>
          </>
        )}
      </section>
    </>
  );
}

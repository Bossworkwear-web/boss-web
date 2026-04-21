"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRightIcon } from "@/app/components/icons";
import { TopNav } from "@/app/components/top-nav";
import { SITE_PAGE_INNER_SHELL_CLASS } from "@/lib/site-layout";
import { MAIN_CATEGORIES } from "@/lib/catalog";
import { hasStorefrontListNameAndPrice, isProductEligibleForSiteSearch } from "@/lib/product-visibility";
import { storefrontRetailFromSupplierBase, STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";
import { productCardDisplayLines } from "@/lib/product-card-copy";
import {
  PRODUCT_CARD_CODE_PRICE_SEPARATOR,
  productCardModelPriceRowStyle,
} from "@/lib/product-card-model-price-layout";
import { productPathSegment } from "@/lib/product-path-slug";
import { productMatchesSearchQuery } from "@/lib/product-search";
import { createSupabaseClient } from "@/lib/supabase";

export type StoreProduct = {
  id: string;
  /** URL segment for `/products/[slug]` */
  slug: string;
  /** Raw `products.slug` from DB (search / Fashion Biz paths) */
  storeSlug?: string | null;
  name: string;
  category: string;
  priceLabel: string;
  embroideryAvailable: boolean;
};

type ProductShowcaseProps = {
  products: StoreProduct[];
  /** Server `searchParams.q`; avoids `useSearchParams` vs SSR mismatch on first paint. */
  initialSearchQuery?: string;
  /** When false, parent (e.g. home `page.tsx`) renders `TopNav` + `HomeHero` above this block. */
  hideTopNav?: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  base_price: number | null;
  slug?: string | null;
  category?: string | null;
  storefront_hidden?: boolean | null;
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
  return {
    id: item.id,
    slug: productPathSegment({ name: item.name, slug: raw }),
    storeSlug: raw,
    name: item.name,
    category: inferCategory(item.name),
    priceLabel: (() => {
      const p = storefrontRetailFromSupplierBase(item.base_price);
      return p != null ? `$${p.toFixed(2)}` : "";
    })(),
    embroideryAvailable: true,
  };
}

export function ProductShowcase({
  products,
  initialSearchQuery = "",
  hideTopNav = false,
}: ProductShowcaseProps) {
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
      const { data, error } = await supabase
        .from("products")
        .select("id, name, base_price, slug, category, storefront_hidden")
        .order("name");

      if (!isMounted || error || !data) {
        return;
      }

      setLiveProducts(
        data
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
    if (!q) {
      return [];
    }
    return liveProducts
      .filter((p) =>
        productMatchesSearchQuery(p.name, p.storeSlug ?? p.slug, p.category, q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [liveProducts, q]);

  return (
    <>
      {hideTopNav ? null : <TopNav />}

      <section className={`${SITE_PAGE_INNER_SHELL_CLASS} py-12`}>
        {q ? (
          <>
            <div className="mb-7 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
                Search
              </p>
              <h2 className="text-3xl font-medium">Results for &ldquo;{q}&rdquo;</h2>
              <p className="text-sm text-brand-navy/65">
                {searchMatches.length} product{searchMatches.length === 1 ? "" : "s"} — by name or style
                code
              </p>
              <p className="text-sm text-brand-navy/55">
                Prices include {Math.round(STOREFRONT_RETAIL_GST_RATE * 100)}% GST.
              </p>
              <p className="text-xs text-brand-navy/55">
                With a search query, this list replaces the featured &ldquo;Shop by Category&rdquo; grid until
                you clear the search box. Category URLs always use{" "}
                <span className="font-medium text-brand-navy/70">/categories/…</span> (bookmark those for a
                specific aisle).
              </p>
            </div>
            {searchMatches.length === 0 ? (
              <p className="rounded-2xl border border-brand-navy/10 bg-brand-surface px-6 py-10 text-center text-brand-navy/75">
                No products matched. Try another name or style code (e.g. ZH145, SG319M).
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchMatches.map((p) => {
                  const { productName, productCode } = productCardDisplayLines(
                    p.name,
                    undefined,
                    p.storeSlug ?? null,
                    undefined,
                    undefined,
                    true,
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
                          {p.priceLabel ? (
                            <>
                              <span
                                className="select-none whitespace-pre text-brand-navy/45"
                                aria-hidden
                              >
                                {PRODUCT_CARD_CODE_PRICE_SEPARATOR}
                              </span>
                              <span className="product-card-grid-price font-semibold text-brand-orange">
                                {p.priceLabel}
                              </span>
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

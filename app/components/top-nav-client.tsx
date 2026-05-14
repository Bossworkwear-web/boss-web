"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AnimationEvent, RefObject } from "react";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CartIcon, MenuIcon, SearchIcon, UserIcon } from "@/app/components/icons";
import { LOGO_SRC } from "@/app/generated/logo";
import { clearCartItems, subscribeCartUpdates, useCartCount } from "@/lib/cart";
import type { StorefrontNavSub } from "@/lib/catalog";
import { readSidebarNavClient } from "@/lib/sidebar-nav";
import { SITE_PAGE_INSET_X_CLASS } from "@/lib/site-layout";

function getCookieValue(name: string) {
  if (typeof document === "undefined") {
    return "";
  }
  const key = `${name}=`;
  const found = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(key));
  return found ? decodeURIComponent(found.slice(key.length)) : "";
}

type ProductSidebarNav = {
  mainSlug: string;
  subSlug: string;
};

type CategoryNavListProps = {
  mainCategories: { slug: string; label: string }[];
  productSidebarNav: ProductSidebarNav | null;
  pathname: string;
  onNavigate?: () => void;
  navClassName?: string;
};

const SERVICE_HREF = "/service";

/** Vertical list — mobile drawer / overlay menu. */
function CategoryNavList({
  mainCategories,
  productSidebarNav,
  pathname,
  onNavigate,
  navClassName = "",
}: CategoryNavListProps) {
  const mainRowClass = (active: boolean) =>
    `store-ui-sidebar-main-link relative z-10 flex min-h-[44px] w-full items-center rounded-lg px-2.5 py-2 text-left font-semibold leading-snug transition [overflow-wrap:anywhere] [word-break:break-word] ${
      active ? "bg-brand-navy text-white" : "text-brand-navy hover:bg-brand-surface hover:text-brand-navy"
    }`;

  return (
    <nav
      aria-label="Store menu"
      className={`store-ui-sidebar-nav-rail flex flex-col gap-[0.525rem] pt-[20px] ${navClassName.trim().length > 0 ? navClassName : "pb-4"}`}
    >
      {mainCategories.map((main) => {
        const isProductContext = pathname.startsWith("/products/");
        const mainHref = `/categories/${main.slug}`;
        const routeShowsThisMain =
          pathname === `/categories/${main.slug}` || pathname.startsWith(`/categories/${main.slug}/`);
        const isMainRowActive =
          routeShowsThisMain || (isProductContext && productSidebarNav?.mainSlug === main.slug);

        return (
          <div key={`sidebar-main-${main.slug}`} className="space-y-1.5">
            <Link
              href={mainHref}
              onClick={() => onNavigate?.()}
              className={mainRowClass(isMainRowActive)}
              aria-current={pathname === `/categories/${main.slug}` ? "page" : undefined}
            >
              {main.label}
            </Link>
          </div>
        );
      })}
      <div className="mt-4 border-t border-brand-navy/10 pt-4">
        <Link
          href={SERVICE_HREF}
          onClick={() => onNavigate?.()}
          className={`mb-2 flex min-h-[44px] w-full items-center rounded-lg px-2.5 py-2 font-semibold transition ${
            pathname === SERVICE_HREF || pathname.startsWith(`${SERVICE_HREF}/`)
              ? "bg-brand-navy text-white"
              : "text-brand-navy hover:bg-brand-surface hover:text-brand-navy"
          }`}
          aria-current={pathname === SERVICE_HREF ? "page" : undefined}
        >
          In-Store Service
        </Link>
        <Link
          href="/contact-us"
          onClick={() => onNavigate?.()}
          className={`store-ui-sidebar-contact-link flex min-h-[44px] w-full items-center rounded-lg px-2.5 py-2 font-semibold transition ${
            pathname === "/contact-us"
              ? "bg-brand-navy text-white"
              : "text-brand-navy hover:bg-brand-surface hover:text-brand-navy"
          }`}
          aria-current={pathname === "/contact-us" ? "page" : undefined}
        >
          Contact us
        </Link>
      </div>
    </nav>
  );
}

/** Single-row header center: category links + hover/focus subcategory panel (large screens). */
function CategoryInlineNav({
  pathname,
  productSidebarNav,
  navSubsByMain,
  mainCategories,
}: {
  pathname: string;
  productSidebarNav: ProductSidebarNav | null;
  navSubsByMain: Record<string, readonly StorefrontNavSub[]>;
  mainCategories: { slug: string; label: string }[];
}) {
  const pillBase =
    "inline-flex shrink-0 items-center rounded-full px-2.5 py-1.5 text-[1.075rem] font-semibold leading-snug transition sm:px-3 sm:py-2 sm:text-[1.235rem]";
  const pillIdle = "text-brand-navy/90 hover:bg-brand-surface hover:text-brand-navy";
  const pillActive = "bg-brand-navy text-white";

  return (
    <nav aria-label="Store navigation" className="flex max-w-full flex-wrap items-center justify-center gap-1 sm:gap-1.5">
      {mainCategories.map((main) => {
        const subCategories = navSubsByMain[main.slug] ?? [];
        const hasSubs = subCategories.length > 0;
        const isProductContext = pathname.startsWith("/products/");
        const mainHref = `/categories/${main.slug}`;
        const routeShowsThisMain =
          pathname === `/categories/${main.slug}` || pathname.startsWith(`/categories/${main.slug}/`);
        const isMainActive =
          routeShowsThisMain || (isProductContext && productSidebarNav?.mainSlug === main.slug);

        return (
          <div key={`top-cat-${main.slug}`} className="group relative flex shrink-0 items-center">
            <Link
              href={mainHref}
              className={`${pillBase} ${isMainActive ? pillActive : pillIdle}`}
              aria-current={pathname === mainHref ? "page" : undefined}
              aria-haspopup={hasSubs ? "menu" : undefined}
            >
              {main.label}
            </Link>
            {hasSubs ? (
              <div className="pointer-events-none absolute left-0 top-full z-[130] hidden pt-1.5 lg:block lg:invisible lg:opacity-0 lg:transition lg:duration-150 lg:ease-out lg:group-hover:pointer-events-auto lg:group-hover:visible lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:visible lg:group-focus-within:opacity-100">
                <ul
                  className="pointer-events-auto w-56 rounded-xl border border-brand-navy/12 bg-white py-2 text-left shadow-xl [overflow-wrap:anywhere] [word-break:break-word]"
                  role="list"
                  aria-label={`${main.label} groupings`}
                >
                  {subCategories.map((sub) => {
                    const subHref = `/categories/${main.slug}/${sub.slug}`;
                    const subActive = pathname === subHref || pathname.startsWith(`${subHref}/`);
                    return (
                      <li key={sub.slug}>
                        <Link
                          href={subHref}
                          className={`block px-4 py-2 text-left text-[0.95rem] font-normal leading-snug transition hover:bg-brand-surface ${
                            subActive ? "bg-brand-surface font-semibold text-brand-navy" : "text-brand-navy/85"
                          }`}
                          aria-current={subActive ? "page" : undefined}
                        >
                          {sub.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="flex shrink-0 items-center">
        <Link
          href={SERVICE_HREF}
          className={`${pillBase} ${
            pathname === SERVICE_HREF || pathname.startsWith(`${SERVICE_HREF}/`) ? pillActive : pillIdle
          }`}
          aria-current={pathname === SERVICE_HREF ? "page" : undefined}
        >
          In-Store Service
        </Link>
      </div>
    </nav>
  );
}

const HEADER_SEARCH_INPUT_CLASS =
  "min-w-0 w-[min(100%,22rem)] rounded-full border border-brand-navy/20 bg-white px-[0.875rem] py-2 text-base leading-snug text-brand-navy placeholder:text-brand-navy/50 focus:border-brand-orange focus:outline-none sm:w-[26rem] sm:px-[1.125rem] sm:py-2.5 sm:text-lg";

/**
 * Same DOM for Suspense fallback and hydrated tree — avoids `<div>` placeholder vs `<form>` mismatch.
 * Fallback uses native GET to `/search`; hydrated form uses `router.push` so `?q=` is always applied reliably.
 */
function HeaderSearchFormView({ inputRef }: { inputRef?: RefObject<HTMLInputElement | null> }) {
  return (
    <form action="/search" method="get" className="flex max-w-full items-center gap-2">
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue=""
        enterKeyHint="search"
        placeholder="Name or style code"
        suppressHydrationWarning
        className={HEADER_SEARCH_INPUT_CLASS}
      />
      <button
        type="submit"
        aria-label="Search"
        className="inline-flex shrink-0 items-center justify-center rounded-full p-2 text-brand-navy transition hover:bg-brand-surface sm:p-2.5"
      >
        <SearchIcon className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>
    </form>
  );
}

function HeaderSearchFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.value = searchParams.get("q") ?? "";
  }, [searchParams]);

  return (
    <form
      className="flex max-w-full items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = (inputRef.current?.value ?? "").trim();
        router.push(v.length > 0 ? `/search?q=${encodeURIComponent(v)}` : "/search");
      }}
    >
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue=""
        enterKeyHint="search"
        placeholder="Name or style code"
        suppressHydrationWarning
        className={HEADER_SEARCH_INPUT_CLASS}
        autoFocus={mounted}
      />
      <button
        type="submit"
        aria-label="Search"
        className="inline-flex shrink-0 items-center justify-center rounded-full p-2 text-brand-navy transition hover:bg-brand-surface sm:p-2.5"
      >
        <SearchIcon className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>
    </form>
  );
}

function HeaderSearchToggle({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [isCollapsing, setIsCollapsing] = useState(false);

  useEffect(() => {
    if (open) {
      setIsCollapsing(false);
    }
  }, [open]);

  const beginClose = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    setIsCollapsing(true);
  }, [onClose]);

  useEffect(() => {
    if (!open || isCollapsing) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        beginClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isCollapsing, beginClose]);

  function onSearchShellAnimationEnd(e: AnimationEvent<HTMLDivElement>) {
    if (e.animationName !== "store-header-search-collapse" || !isCollapsing) {
      return;
    }
    setIsCollapsing(false);
    onClose();
  }

  return open ? (
    <div
      className={`flex max-w-full items-center gap-1.5 ${
        isCollapsing ? "store-header-search-collapse" : "store-header-search-expand"
      }`}
      onAnimationEnd={onSearchShellAnimationEnd}
    >
      <Suspense fallback={<HeaderSearchFormView />}>
        <HeaderSearchFormInner />
      </Suspense>
      <button
        type="button"
        onClick={beginClose}
        className="inline-flex shrink-0 items-center justify-center rounded-full p-2 text-brand-navy transition hover:bg-brand-surface sm:p-2.5"
        aria-label="Close search"
      >
        <span className="text-xl leading-none sm:text-2xl" aria-hidden>
          ×
        </span>
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex shrink-0 items-center justify-center rounded-full p-2 text-brand-navy transition hover:bg-brand-surface sm:p-2.5"
      aria-label="Open search"
    >
      <SearchIcon className="h-5 w-5 sm:h-6 sm:w-6" />
    </button>
  );
}

export function TopNavClient({
  navSubsByMain,
  mainCategories,
}: {
  navSubsByMain: Record<string, readonly StorefrontNavSub[]>;
  mainCategories: { slug: string; label: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const headerShellRef = useRef<HTMLElement | null>(null);
  const cartCount = useCartCount();
  const [customerName, setCustomerName] = useState("");
  const [logoutNoticeVisible, setLogoutNoticeVisible] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [productSidebarNav, setProductSidebarNav] = useState<ProductSidebarNav | null>(null);
  const [headerElevated, setHeaderElevated] = useState(false);

  useLayoutEffect(() => {
    const node = headerShellRef.current;
    if (!node || typeof document === "undefined") {
      return;
    }
    let rafId = 0;
    let lastHeight = -1;
    const flushHeaderHeight = () => {
      rafId = 0;
      const h = node.offsetHeight;
      if (h === lastHeight) {
        return;
      }
      lastHeight = h;
      document.documentElement.style.setProperty("--site-header-height", `${h}px`);
    };
    const scheduleHeaderHeight = () => {
      if (rafId) {
        return;
      }
      rafId = requestAnimationFrame(flushHeaderHeight);
    };
    flushHeaderHeight();
    const ro = new ResizeObserver(scheduleHeaderHeight);
    ro.observe(node);
    window.addEventListener("resize", scheduleHeaderHeight);
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      ro.disconnect();
      window.removeEventListener("resize", scheduleHeaderHeight);
    };
  }, []);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        setHeaderElevated(window.scrollY > 6);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setHeaderElevated(window.scrollY > 6);
  }, []);

  useEffect(() => {
    const syncCustomerName = () => {
      setCustomerName(getCookieValue("customer_name"));
    };
    syncCustomerName();
    const unsubscribe = subscribeCartUpdates(() => {
      syncCustomerName();
    });
    const timerId = window.setTimeout(syncCustomerName, 0);
    return () => {
      window.clearTimeout(timerId);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/products/")) {
      setProductSidebarNav(null);
      return;
    }
    const nav = readSidebarNavClient();
    setProductSidebarNav(nav);
  }, [pathname]);

  useEffect(() => {
    const onSidebarNav = () => {
      if (!pathname.startsWith("/products/")) {
        return;
      }
      const nav = readSidebarNavClient();
      setProductSidebarNav(nav);
    };
    window.addEventListener("boss-sidebar-nav", onSidebarNav);
    return () => window.removeEventListener("boss-sidebar-nav", onSidebarNav);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen || typeof document === "undefined") {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!logoutNoticeVisible) {
      return;
    }
    const id = window.setTimeout(() => setLogoutNoticeVisible(false), 5000);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLogoutNoticeVisible(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [logoutNoticeVisible]);

  useEffect(() => {
    if (!mobileNavOpen || typeof window === "undefined") {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  function handleLogOut() {
    document.cookie = "customer_name=; Max-Age=0; path=/";
    document.cookie = "customer_email=; Max-Age=0; path=/";
    document.cookie = "customer_delivery_address=; Max-Age=0; path=/";
    clearCartItems();
    setCustomerName("");
    setMobileNavOpen(false);
    setLogoutNoticeVisible(true);
    const leaveToHome =
      pathname === "/customer" ||
      pathname.startsWith("/customer/") ||
      pathname === "/customer-details";
    if (leaveToHome) {
      router.push("/");
    }
  }

  return (
    <>
      <section
        ref={headerShellRef}
        className={`store-top-nav-shell fixed inset-x-0 top-0 z-[110] bg-white ${
          headerElevated ? "is-elevated" : ""
        }`}
      >
        <nav
          className={`mx-auto flex w-full max-w-none flex-col gap-y-1 py-2.5 sm:gap-y-[0.3125rem] sm:py-3.5 ${SITE_PAGE_INSET_X_CLASS}`}
        >
          <div className="flex w-full items-center gap-2 sm:gap-3">
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex items-center justify-center rounded-lg border border-brand-navy/25 p-2 text-brand-navy lg:hidden"
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-store-menu"
                aria-haspopup="dialog"
              >
                <MenuIcon className="h-6 w-6" />
                <span className="sr-only">Open full menu</span>
              </button>
              <Link href="/" className="inline-flex items-center px-0.5 py-0.5 sm:px-1 sm:py-1" aria-label="Home">
                <Image
                  src={LOGO_SRC}
                  alt="Boss Workwear"
                  width={360}
                  height={108}
                  className="h-[4.8rem] w-auto sm:h-[5.4rem]"
                  priority
                />
              </Link>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center px-2 lg:flex">
              <CategoryInlineNav
                pathname={pathname}
                productSidebarNav={productSidebarNav}
                navSubsByMain={navSubsByMain}
                mainCategories={mainCategories}
              />
            </div>

            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2 md:gap-3">
              {customerName ? (
                <>
                  <Link
                    href="/customer"
                    className="max-w-[9rem] truncate rounded-full bg-brand-surface px-2.5 py-2 text-xs font-medium leading-snug text-brand-navy transition hover:bg-brand-navy/10 sm:max-w-none sm:px-[1.125rem] sm:py-2.5 sm:text-[1.3125rem]"
                    title={customerName}
                  >
                    Hi, {customerName}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogOut}
                    className="rounded-full px-2.5 py-2 text-xs font-medium leading-snug text-brand-navy transition hover:bg-brand-surface sm:px-[1.125rem] sm:py-2.5 sm:text-[1.3125rem]"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  href="/log-in"
                  className={`inline-flex items-center justify-center rounded-full p-2 sm:p-2.5 ${
                    pathname === "/log-in" ? "bg-brand-orange text-brand-navy" : "text-brand-navy hover:bg-brand-surface"
                  }`}
                  aria-label="Sign in"
                >
                  <UserIcon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                </Link>
              )}
              <Link
                href="/cart"
                className={`relative inline-flex items-center justify-center gap-1 rounded-full p-2 sm:p-2.5 ${
                  pathname === "/cart" ? "bg-brand-orange text-brand-navy" : "text-brand-navy hover:bg-brand-surface"
                }`}
                aria-label="Cart"
              >
                <span
                  className={
                    pathname !== "/cart" && cartCount > 0
                      ? "store-cart-icon-animate shrink-0"
                      : "inline-flex shrink-0"
                  }
                >
                  <CartIcon className="h-[1.5125rem] w-[1.5125rem] shrink-0 sm:h-[1.815rem] sm:w-[1.815rem]" />
                </span>
                {cartCount > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-navy px-1.5 text-xs font-medium text-white sm:min-w-6 sm:px-2 sm:text-sm">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          <div className="flex min-h-[3.75rem] w-full items-center justify-center pt-1 sm:min-h-[4rem] sm:pt-[0.3125rem]">
            <HeaderSearchToggle
              open={searchOpen}
              onOpen={() => setSearchOpen(true)}
              onClose={() => setSearchOpen(false)}
            />
          </div>
        </nav>
      </section>

      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-[120] lg:hidden"
          id="mobile-store-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Shop navigation"
        >
          <button
            type="button"
            className="absolute inset-0 z-0 bg-black/45"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="store-sidebar-menu store-ui-nav-drawer-panel absolute bottom-0 left-0 top-0 z-10 flex flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-brand-navy/10 px-4 py-3">
              <p className="text-sm font-medium uppercase tracking-[0.08em] text-brand-navy">Full menu</p>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-navy hover:bg-brand-surface"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CategoryNavList
                mainCategories={mainCategories}
                productSidebarNav={productSidebarNav}
                pathname={pathname}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {logoutNoticeVisible ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-5 sm:p-8"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="logout-notice-title"
          aria-describedby="logout-notice-desc"
          onClick={() => setLogoutNoticeVisible(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-brand-navy/10 bg-white px-8 py-8 text-center shadow-2xl sm:max-w-xl sm:px-12 sm:py-10"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="logout-notice-title" className="text-xl font-semibold text-brand-navy sm:text-2xl">
              Signed out
            </p>
            <p id="logout-notice-desc" className="mt-4 text-lg leading-snug text-brand-navy/80 sm:mt-5 sm:text-xl">
              You have been logged out.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

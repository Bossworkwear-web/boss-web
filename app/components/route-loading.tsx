"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";

import { LoadingRingSpinner } from "@/app/components/loading-ring-spinner";
import {
  getRouteLoadingOverlayOptions,
  getRouteLoadingSnapshot,
  ROUTE_LOADING_START_EVENT,
  shouldStartRouteLoadingForAnchor,
  shouldStartRouteLoadingForUrl,
  startRouteLoading,
  stopRouteLoading,
  subscribeRouteLoading,
} from "@/lib/route-loading";

function onLinkIntent(event: Event) {
  if (!(event instanceof MouseEvent) && !(event instanceof PointerEvent)) {
    return;
  }
  if (event.button !== 0) {
    return;
  }
  const anchor = (event.target as Element | null)?.closest("a");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return;
  }
  if (!shouldStartRouteLoadingForAnchor(anchor, event as unknown as MouseEvent)) {
    return;
  }
  startRouteLoading();
}

function RouteLoadingInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    stopRouteLoading();
  }, [pathname, search]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onNavigationStart = () => {
      startRouteLoading();
    };

    const onPopState = () => {
      if (shouldStartRouteLoadingForUrl(window.location.href)) {
        startRouteLoading();
      }
    };

    const onNavigate = (event: Event) => {
      if (!("destination" in event) || !("navigationType" in event)) {
        return;
      }
      const nav = event as Event & {
        navigationType: string;
        destination: { sameDocument: boolean; url: string };
      };
      if (nav.navigationType === "reload") {
        return;
      }
      const dest = nav.destination;
      if (!dest.sameDocument) {
        return;
      }
      try {
        const url = new URL(dest.url);
        if (url.origin !== window.location.origin) {
          return;
        }
        const current = new URL(window.location.href);
        if (url.pathname === current.pathname && url.search === current.search) {
          return;
        }
        startRouteLoading();
      } catch {
        // ignore invalid URLs
      }
    };

    window.addEventListener(ROUTE_LOADING_START_EVENT, onNavigationStart);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onLinkIntent, true);

    const navigationApi = (window as Window & { navigation?: EventTarget }).navigation;
    navigationApi?.addEventListener("navigate", onNavigate);

    return () => {
      window.removeEventListener(ROUTE_LOADING_START_EVENT, onNavigationStart);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onLinkIntent, true);
      navigationApi?.removeEventListener("navigate", onNavigate);
    };
  }, [pathname]);

  return null;
}

function RouteLoadingOverlay() {
  const pending = useSyncExternalStore(subscribeRouteLoading, getRouteLoadingSnapshot, () => false);
  const overlay = useSyncExternalStore(
    subscribeRouteLoading,
    getRouteLoadingOverlayOptions,
    () => null,
  );

  if (!pending) {
    return null;
  }

  if (overlay) {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-5 sm:p-8"
        role="alertdialog"
        aria-modal="true"
        aria-busy="true"
        aria-labelledby="route-loading-overlay-title"
        aria-live="polite"
      >
        <div className="w-full max-w-sm rounded-3xl border border-brand-navy/10 bg-white px-8 py-8 text-center shadow-2xl sm:max-w-md sm:px-10 sm:py-10">
          <div className="flex items-center justify-center gap-3">
            <LoadingRingSpinner />
            <p id="route-loading-overlay-title" className="text-xl font-semibold text-brand-navy sm:text-2xl">
              {overlay.title}
            </p>
          </div>
          {overlay.description ? (
            <p className="mt-3 text-sm text-brand-navy/65">{overlay.description}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-5 sm:p-8"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Please wait a moment"
    >
      <div className="w-full max-w-sm rounded-3xl border border-brand-navy/10 bg-white px-8 py-8 text-center shadow-2xl sm:max-w-md sm:px-10 sm:py-10">
        <div className="flex flex-col items-center gap-3">
          <LoadingRingSpinner className="h-10 w-10" />
          <p className="text-base font-medium text-brand-navy sm:text-lg">Please wait a moment</p>
        </div>
      </div>
    </div>
  );
}

/** Centered spinner on client-side navigation (storefront + admin). */
export function RouteLoading() {
  return (
    <Suspense fallback={null}>
      <RouteLoadingInner />
      <RouteLoadingOverlay />
    </Suspense>
  );
}

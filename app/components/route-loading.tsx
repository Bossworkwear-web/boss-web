"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";

import { LoadingRingSpinner } from "@/app/components/loading-ring-spinner";
import {
  getRouteLoadingOverlayOptions,
  getRouteLoadingSnapshot,
  ROUTE_LOADING_START_EVENT,
  shouldStartRouteLoadingForAnchor,
  startRouteLoading,
  stopRouteLoading,
  subscribeRouteLoading,
} from "@/lib/route-loading";

function onLinkIntent(event: Event) {
  if (!(event instanceof MouseEvent)) {
    return;
  }
  if (event.button !== 0) {
    return;
  }
  const anchor = (event.target as Element | null)?.closest("a");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return;
  }
  if (!shouldStartRouteLoadingForAnchor(anchor, event)) {
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
      startRouteLoading({ immediate: true });
    };

    window.addEventListener(ROUTE_LOADING_START_EVENT, onNavigationStart);
    document.addEventListener("click", onLinkIntent, true);

    return () => {
      window.removeEventListener(ROUTE_LOADING_START_EVENT, onNavigationStart);
      document.removeEventListener("click", onLinkIntent, true);
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

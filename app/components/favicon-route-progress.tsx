"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect } from "react";

import {
  ensureFaviconHistoryHooks,
  FAVICON_NAVIGATION_START_EVENT,
  shouldStartFaviconForAnchor,
  startFaviconRouteLoading,
  stopFaviconRouteLoading,
} from "@/lib/favicon-route-progress";

function FaviconRouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useLayoutEffect(() => {
    ensureFaviconHistoryHooks();
  }, [pathname, search]);

  useEffect(() => {
    stopFaviconRouteLoading();
  }, [pathname, search]);

  useEffect(() => {
    if (typeof window === "undefined" || pathname.startsWith("/admin")) {
      return;
    }

    const onNavigationStart = () => {
      startFaviconRouteLoading();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if (!shouldStartFaviconForAnchor(anchor, event as unknown as MouseEvent)) {
        return;
      }
      startFaviconRouteLoading();
    };

    window.addEventListener(FAVICON_NAVIGATION_START_EVENT, onNavigationStart);
    document.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      window.removeEventListener(FAVICON_NAVIGATION_START_EVENT, onNavigationStart);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [pathname]);

  return null;
}

/** Animated favicon while client-side routes load (storefront only). */
export function FaviconRouteProgress() {
  return (
    <Suspense fallback={null}>
      <FaviconRouteProgressInner />
    </Suspense>
  );
}

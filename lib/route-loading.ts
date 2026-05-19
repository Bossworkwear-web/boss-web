import {
  hideRouteProgressBar,
  showRouteProgressBar,
} from "@/lib/route-progress-bar-dom";

/** Dispatch before programmatic `router.push` (e.g. header search). */
export const ROUTE_LOADING_START_EVENT = "boss:route-loading-start";

const MIN_BAR_MS = 380;

let loading = false;
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let stopDelayId: ReturnType<typeof setTimeout> | null = null;
let loadingStartedAt = 0;

function runAfterCommit(fn: () => void) {
  setTimeout(fn, 0);
}

function stopRouteLoadingNow() {
  loading = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  runAfterCommit(() => {
    hideRouteProgressBar();
  });
}

export function startRouteLoading() {
  if (typeof document === "undefined") {
    return;
  }
  if (stopDelayId) {
    clearTimeout(stopDelayId);
    stopDelayId = null;
  }
  loadingStartedAt = Date.now();
  loading = true;
  runAfterCommit(() => {
    showRouteProgressBar();
  });

  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(() => {
    stopRouteLoading();
  }, 20_000);
}

export function stopRouteLoading() {
  if (typeof document === "undefined" || !loading) {
    return;
  }
  const elapsed = Date.now() - loadingStartedAt;
  const wait = MIN_BAR_MS - elapsed;
  if (wait > 0) {
    if (stopDelayId) {
      clearTimeout(stopDelayId);
    }
    stopDelayId = setTimeout(() => {
      stopDelayId = null;
      stopRouteLoadingNow();
    }, wait);
    return;
  }
  stopRouteLoadingNow();
}

/** Call before client-side navigation that does not originate from a link click. */
export function notifyRouteLoadingStart() {
  if (typeof window === "undefined") {
    return;
  }
  startRouteLoading();
  window.dispatchEvent(new Event(ROUTE_LOADING_START_EVENT));
}

export function shouldStartRouteLoadingForAnchor(
  anchor: HTMLAnchorElement,
  event: MouseEvent,
): boolean {
  if (event.defaultPrevented) {
    return false;
  }
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const target = anchor.getAttribute("target");
  if (target && target !== "_self") {
    return false;
  }
  if (anchor.hasAttribute("download")) {
    return false;
  }
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }
  return shouldStartRouteLoadingForUrl(href);
}

export function shouldStartRouteLoadingForUrl(url: URL | string): boolean {
  try {
    const dest = typeof url === "string" ? new URL(url, window.location.href) : url;
    if (dest.origin !== window.location.origin) {
      return false;
    }
    if (dest.pathname.startsWith("/admin")) {
      return false;
    }
    const current = new URL(window.location.href);
    return dest.pathname !== current.pathname || dest.search !== current.search;
  } catch {
    return false;
  }
}

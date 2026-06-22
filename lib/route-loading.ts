/** Dispatch before programmatic `router.push` (e.g. header search). */
export const ROUTE_LOADING_START_EVENT = "boss:route-loading-start";

/** Only show the full-screen overlay when navigation exceeds this (avoids flash on fast transitions). */
const SHOW_OVERLAY_DELAY_MS = 200;

export type RouteLoadingOverlayOptions = {
  title: string;
  description?: string;
};

type RouteLoadingStartOptions = {
  overlay?: RouteLoadingOverlayOptions;
  /** When true, show overlay immediately (search, admin tab switches). */
  immediate?: boolean;
};

let loading = false;
let visible = false;
let overlayOptions: RouteLoadingOverlayOptions | null = null;
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let showDelayId: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
let emitScheduled = false;

/** Defer subscriber notifications so navigation handlers do not re-render during commit. */
function scheduleEmitRouteLoadingChange() {
  if (emitScheduled) {
    return;
  }
  emitScheduled = true;
  queueMicrotask(() => {
    emitScheduled = false;
    listeners.forEach((listener) => listener());
  });
}

export function subscribeRouteLoading(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether the full-screen overlay should render. */
export function getRouteLoadingSnapshot() {
  return visible;
}

export function getRouteLoadingOverlayOptions() {
  return overlayOptions;
}

function clearShowDelay() {
  if (showDelayId) {
    clearTimeout(showDelayId);
    showDelayId = null;
  }
}

function scheduleShowOverlay(immediate: boolean) {
  clearShowDelay();
  if (immediate) {
    visible = true;
    scheduleEmitRouteLoadingChange();
    return;
  }
  showDelayId = setTimeout(() => {
    showDelayId = null;
    if (loading) {
      visible = true;
      scheduleEmitRouteLoadingChange();
    }
  }, SHOW_OVERLAY_DELAY_MS);
}

function stopRouteLoadingNow() {
  loading = false;
  visible = false;
  overlayOptions = null;
  clearShowDelay();
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  scheduleEmitRouteLoadingChange();
}

export function startRouteLoading(options?: RouteLoadingStartOptions) {
  if (typeof document === "undefined") {
    return;
  }
  const immediate = Boolean(options?.immediate || options?.overlay);
  if (options?.overlay) {
    overlayOptions = options.overlay;
  } else if (!loading) {
    overlayOptions = null;
  }
  loading = true;
  if (!visible) {
    scheduleShowOverlay(immediate);
  } else {
    scheduleEmitRouteLoadingChange();
  }

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
  stopRouteLoadingNow();
}

const SEARCH_LOADING_OVERLAY: RouteLoadingOverlayOptions = {
  title: "Searching...",
  description: "Please wait while we find matching products.",
};

/** Call before client-side navigation that does not originate from a link click. */
export function notifyRouteLoadingStart(options?: RouteLoadingStartOptions) {
  if (typeof window === "undefined") {
    return;
  }
  startRouteLoading({ ...options, immediate: options?.immediate ?? true });
  window.dispatchEvent(new Event(ROUTE_LOADING_START_EVENT));
}

export function notifyProductSearchLoadingStart() {
  notifyRouteLoadingStart({ overlay: SEARCH_LOADING_OVERLAY, immediate: true });
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
    const current = new URL(window.location.href);
    return dest.pathname !== current.pathname || dest.search !== current.search;
  } catch {
    return false;
  }
}

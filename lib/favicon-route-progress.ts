/** Default storefront favicon (matches root layout metadata). */
export const FAVICON_DEFAULT_HREF = "/Boss_favicon.svg";

/** Animated orange ring — same visual for every client navigation. */
export const FAVICON_LOADING_HREF = "/favicon-loading.svg";

/** Dispatch before programmatic `router.push` if Navigation API is unavailable. */
export const FAVICON_NAVIGATION_START_EVENT = "boss:favicon-navigation-start";

const CANVAS_SIZE = 32;
const BRAND_ORANGE = "#ff851b";
const MIN_SPINNER_MS = 380;
const RING_RADIUS = 12;
const RING_LINE_WIDTH = 3;
const RING_ARC = Math.PI * 1.6;

let loading = false;
let angle = 0;
let rafId: number | null = null;
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let stopDelayId: ReturnType<typeof setTimeout> | null = null;
let loadingStartedAt = 0;
let canvas: HTMLCanvasElement | null = null;
let historyHooksInstalled = false;
let useCanvasFallback = false;

type PatchedHistoryFn = History["pushState"] & { __bossFaviconWrapped?: boolean };

function setAllIconHrefs(href: string) {
  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((node) => {
    (node as HTMLLinkElement).href = href;
  });
}

function getCanvas(): HTMLCanvasElement {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
  }
  return canvas;
}

/** Canvas frame matches `public/favicon-loading.svg` (transparent bg, orange ring only). */
function drawSpinnerFrame(rotation: number) {
  const c = getCanvas();
  const ctx = c.getContext("2d");
  if (!ctx) {
    return;
  }
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.strokeStyle = BRAND_ORANGE;
  ctx.lineWidth = RING_LINE_WIDTH;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, RING_RADIUS, rotation, rotation + RING_ARC);
  ctx.stroke();
  setAllIconHrefs(c.toDataURL("image/png"));
}

function tick() {
  if (!loading || !useCanvasFallback) {
    return;
  }
  angle += 0.22;
  drawSpinnerFrame(angle);
  rafId = requestAnimationFrame(tick);
}

function prefersSvgFaviconAnimation(): boolean {
  if (typeof document === "undefined") {
    return true;
  }
  const ua = navigator.userAgent;
  if (/Firefox/i.test(ua)) {
    return false;
  }
  return true;
}

function stopFaviconRouteLoadingNow() {
  loading = false;
  useCanvasFallback = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  setAllIconHrefs(FAVICON_DEFAULT_HREF);
}

export function startFaviconRouteLoading() {
  if (typeof document === "undefined") {
    return;
  }
  if (stopDelayId) {
    clearTimeout(stopDelayId);
    stopDelayId = null;
  }
  loadingStartedAt = Date.now();
  loading = true;

  if (prefersSvgFaviconAnimation()) {
    useCanvasFallback = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    setAllIconHrefs(FAVICON_LOADING_HREF);
  } else {
    useCanvasFallback = true;
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    tick();
  }

  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(() => {
    stopFaviconRouteLoading();
  }, 20_000);
}

export function stopFaviconRouteLoading() {
  if (typeof document === "undefined" || !loading) {
    return;
  }
  const elapsed = Date.now() - loadingStartedAt;
  const wait = MIN_SPINNER_MS - elapsed;
  if (wait > 0) {
    if (stopDelayId) {
      clearTimeout(stopDelayId);
    }
    stopDelayId = setTimeout(() => {
      stopDelayId = null;
      stopFaviconRouteLoadingNow();
    }, wait);
    return;
  }
  stopFaviconRouteLoadingNow();
}

/** Call before client-side navigation that does not originate from a link click. */
export function notifyFaviconNavigationStart() {
  if (typeof window === "undefined") {
    return;
  }
  startFaviconRouteLoading();
  window.dispatchEvent(new Event(FAVICON_NAVIGATION_START_EVENT));
}

export function shouldStartFaviconForAnchor(anchor: HTMLAnchorElement, event: MouseEvent): boolean {
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
  return shouldStartFaviconForNavigationUrl(href);
}

export function shouldStartFaviconForNavigationUrl(url: URL | string): boolean {
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

function wrapHistoryMethod(method: "pushState" | "replaceState") {
  const current = history[method] as PatchedHistoryFn;
  if (current.__bossFaviconWrapped) {
    return;
  }
  const original = current.bind(history) as PatchedHistoryFn;
  const wrapped: PatchedHistoryFn = ((...args: Parameters<History["pushState"]>) => {
    const url = args[2];
    if (url != null) {
      const href = typeof url === "string" ? url : url.toString();
      if (shouldStartFaviconForNavigationUrl(href)) {
        startFaviconRouteLoading();
      }
    }
    return original(...args);
  }) as PatchedHistoryFn;
  wrapped.__bossFaviconWrapped = true;
  history[method] = wrapped;
}

/** Chain onto Next.js App Router history patches (re-run after each navigation). */
export function ensureFaviconHistoryHooks() {
  if (typeof window === "undefined") {
    return;
  }
  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");
  if (!historyHooksInstalled) {
    window.addEventListener("popstate", () => {
      if (shouldStartFaviconForNavigationUrl(window.location.href)) {
        startFaviconRouteLoading();
      }
    });
    historyHooksInstalled = true;
  }
}

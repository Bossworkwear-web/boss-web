import type { CategoryBrowseProductRow } from "@/lib/main-category-browse";

const SESSION_KEY = "boss-storefront-browse-catalog-v1";
const SESSION_TS_KEY = "boss-storefront-browse-catalog-v1-ts";
const SESSION_TTL_MS = 60_000;

let memoryCache: CategoryBrowseProductRow[] | null = null;
let memoryFetchedAt = 0;
let inflight: Promise<CategoryBrowseProductRow[]> | null = null;

function readSessionCache(): CategoryBrowseProductRow[] | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const ts = Number(sessionStorage.getItem(SESSION_TS_KEY) ?? "0");
    if (!ts || Date.now() - ts > SESSION_TTL_MS) {
      return null;
    }
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CategoryBrowseProductRow[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSessionCache(rows: CategoryBrowseProductRow[]): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(rows));
    sessionStorage.setItem(SESSION_TS_KEY, String(Date.now()));
  } catch {
    /* quota / private mode */
  }
}

async function fetchBrowseCatalogFromApi(): Promise<CategoryBrowseProductRow[]> {
  const res = await fetch("/api/storefront/browse-catalog", { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`Browse catalog HTTP ${res.status}`);
  }
  const data = (await res.json()) as CategoryBrowseProductRow[];
  if (!Array.isArray(data)) {
    throw new Error("Browse catalog response invalid");
  }
  return data;
}

/** One catalog fetch per tab session — reused across category navigations. */
export async function getStorefrontBrowseCatalogClient(): Promise<CategoryBrowseProductRow[]> {
  const now = Date.now();
  if (memoryCache && now - memoryFetchedAt < SESSION_TTL_MS) {
    return memoryCache;
  }

  const fromSession = readSessionCache();
  if (fromSession?.length) {
    memoryCache = fromSession;
    memoryFetchedAt = now;
    return fromSession;
  }

  if (!inflight) {
    inflight = fetchBrowseCatalogFromApi()
      .then((rows) => {
        memoryCache = rows;
        memoryFetchedAt = Date.now();
        writeSessionCache(rows);
        return rows;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

/** Warm catalog in the background (e.g. hover on category nav). */
export function prefetchStorefrontBrowseCatalogClient(): void {
  void getStorefrontBrowseCatalogClient().catch(() => {});
}

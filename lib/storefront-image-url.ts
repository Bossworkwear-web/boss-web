const MEDIA_PREFIX = "/api/supplier-media/";
const MEDIA_PREFIX_LOOSE = "api/supplier-media/";

/** Default bucket in `scripts/upload-supplier-images.mjs` / middleware (must match DB rows from `--images=storage`). */
const DEFAULT_SUPPLIER_IMAGES_BUCKET = "supplier-product-images";

function collapseSlashes(path: string): string {
  return path.replace(/\/+/g, "/");
}

/**
 * When catalogue rows store full `…/storage/v1/object/public/<bucket>/…` URLs, load them via our
 * same-origin proxy so Chrome does not apply ORB to cross-origin image responses.
 */
function rewriteProjectSupabaseStorageUrlToSupplierMediaProxy(raw: string): string | null {
  const s0 = raw.trim();
  if (!s0.startsWith("http://") && !s0.startsWith("https://")) {
    return null;
  }
  let u: URL;
  try {
    u = new URL(s0);
  } catch {
    return null;
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    return null;
  }
  try {
    if (u.origin !== new URL(base).origin) {
      return null;
    }
  } catch {
    return null;
  }
  const bucket =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPPLIER_IMAGES_BUCKET?.trim()) ||
    DEFAULT_SUPPLIER_IMAGES_BUCKET;
  const prefix = `/storage/v1/object/public/${bucket}/`;
  if (!u.pathname.startsWith(prefix)) {
    return null;
  }
  const tail = u.pathname.slice(prefix.length);
  const segments = tail
    .split("/")
    .filter(Boolean)
    .map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    });
  if (segments.length < 2) {
    return null;
  }
  return collapseSlashes(`${MEDIA_PREFIX}${segments.join("/")}`);
}

/**
 * If `raw` is (or contains) a supplier-media catalogue path, return normalized `/api/supplier-media/…`.
 * Otherwise return null so callers keep the original URL (e.g. full https Supabase, Unsplash).
 */
function normalizedSupplierMediaPath(raw: string): string | null {
  const s0 = raw.trim();
  if (!s0) return null;

  if (s0.startsWith("http://") || s0.startsWith("https://")) {
    if (!s0.includes("/api/supplier-media/")) {
      return null;
    }
    try {
      const pathOnly = new URL(s0).pathname;
      if (!pathOnly.startsWith(MEDIA_PREFIX)) {
        return null;
      }
      return collapseSlashes(pathOnly);
    } catch {
      return null;
    }
  }

  if (s0.startsWith(MEDIA_PREFIX)) {
    return collapseSlashes(s0);
  }

  const idx = s0.toLowerCase().indexOf(MEDIA_PREFIX_LOOSE);
  if (idx >= 0) {
    const tail = s0.slice(idx + MEDIA_PREFIX_LOOSE.length).replace(/^\/+/, "");
    return collapseSlashes(`${MEDIA_PREFIX}${tail}`);
  }

  return null;
}

/**
 * Catalogue `image_urls` usually store `/api/supplier-media/<supplier>/…` **or** full Supabase public
 * object URLs. Prefer same-origin `/api/supplier-media/…` (served by `app/api/supplier-media`) so
 * the browser does not load cross-origin storage URLs (Chrome ORB on some redirects/responses).
 *
 * Other absolute URLs (Unsplash, etc.) are left unchanged unless they embed `/api/supplier-media/`.
 */
export function resolveStorefrontImageUrl(url: string | null | undefined): string {
  const raw = typeof url === "string" ? url.trim() : "";
  if (!raw) return "";
  if (raw.startsWith("data:")) {
    return raw;
  }

  const fromSupabasePublic = rewriteProjectSupabaseStorageUrlToSupplierMediaProxy(raw);
  if (fromSupabasePublic) {
    return fromSupabasePublic;
  }

  const norm = normalizedSupplierMediaPath(raw);
  if (norm) {
    return norm;
  }
  return raw;
}

export function resolveStorefrontImageUrlList(urls: string[] | null | undefined): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .map((u) => {
      const t = typeof u === "string" ? u.trim() : "";
      if (!t) return "";
      const r = resolveStorefrontImageUrl(t);
      return r.length > 0 ? r : t;
    })
    .filter((s) => s.length > 0);
}

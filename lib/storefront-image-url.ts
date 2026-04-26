const MEDIA_PREFIX = "/api/supplier-media/";
const MEDIA_PREFIX_LOOSE = "api/supplier-media/";

function collapseSlashes(path: string): string {
  return path.replace(/\/+/g, "/");
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
 * Catalogue `image_urls` often store `/api/supplier-media/<supplier>/…`. Keep them as **same-origin**
 * paths so the browser always loads `https://<your-site>/api/…` and Edge middleware issues 307 to
 * Supabase public storage. Avoids client/build-time `NEXT_PUBLIC_SUPABASE_URL` and encoding drift
 * when rewriting to absolute storage URLs in React.
 *
 * Already-absolute URLs (Supabase, CDNs, data:, etc.) are left unchanged unless they wrap our
 * `/api/supplier-media/` path (then we normalize to the path only).
 */
export function resolveStorefrontImageUrl(url: string | null | undefined): string {
  const raw = typeof url === "string" ? url.trim() : "";
  if (!raw) return "";
  if (raw.startsWith("data:")) {
    return raw;
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

import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";

const MEDIA_PREFIX = "/api/supplier-media/";
const MEDIA_PREFIX_LOOSE = "api/supplier-media/";

function supplierImagesBucket(): string {
  return process.env.SUPPLIER_IMAGES_BUCKET ?? "supplier-product-images";
}

/**
 * Catalogue rows often store `/api/supplier-media/<supplier>/…`; middleware redirects that to
 * Supabase public storage, but `<img src>` is more reliable with the final HTTPS URL (CDN,
 * crawlers, rare redirect edge cases). Same object key as the redirect path.
 */
export function resolveStorefrontImageUrl(url: string | null | undefined): string {
  let raw = typeof url === "string" ? url.trim() : "";
  if (!raw) return "";

  if ((raw.startsWith("http://") || raw.startsWith("https://")) && raw.includes("/api/supplier-media/")) {
    try {
      const pathOnly = new URL(raw).pathname;
      if (pathOnly.startsWith(MEDIA_PREFIX)) {
        raw = pathOnly;
      } else {
        return typeof url === "string" ? url.trim() : "";
      }
    } catch {
      return typeof url === "string" ? url.trim() : "";
    }
  } else if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
    return raw;
  }

  let rest: string | null = null;
  if (raw.startsWith(MEDIA_PREFIX)) {
    rest = raw.slice(MEDIA_PREFIX.length);
  } else {
    const lower = raw.toLowerCase();
    const idx = lower.indexOf(MEDIA_PREFIX_LOOSE);
    if (idx >= 0) {
      rest = raw.slice(idx + MEDIA_PREFIX_LOOSE.length);
    } else {
      return raw;
    }
  }

  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) {
    return typeof url === "string" ? url.trim() : "";
  }
  const objectPath = parts.join("/").replace(/\/+/g, "/");
  const out = publicStorageObjectUrl(supplierImagesBucket(), objectPath);
  return out || (typeof url === "string" ? url.trim() : "");
}

export function resolveStorefrontImageUrlList(urls: string[] | null | undefined): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.map((u) => resolveStorefrontImageUrl(u)).filter((s) => s.length > 0);
}

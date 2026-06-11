const DNC_HIRES_PREFIX = "https://www.dncworkwear.com.au/images/hires/";
const DNC_PRODUCT_PREFIX = "https://www.dncworkwear.com.au/images/productimages/";
const MEDIA_API_PREFIX = "/api/supplier-media/";
const SUPPLIER_FOLDER = "dnc";

export function isDncExternalImageUrl(url) {
  const s = String(url ?? "").trim();
  return /^https?:\/\/(?:www\.)?dncworkwear\.com\.au\/images\//i.test(s);
}

export function isDncMigratedMediaUrl(url) {
  const s = String(url ?? "").trim();
  return s.includes("/api/supplier-media/dnc/");
}

export function filenameFromDncUrl(url) {
  try {
    const u = new URL(String(url).trim());
    const base = u.pathname.split("/").pop() ?? "";
    return decodeURIComponent(base).trim();
  } catch {
    const s = String(url ?? "").trim();
    const base = s.split("/").pop()?.split("?")[0] ?? "";
    try {
      return decodeURIComponent(base).trim();
    } catch {
      return base.trim();
    }
  }
}

/** hires URL → productimages URL (same filename). */
export function dncProductImageUrlFromHires(hiresUrl) {
  const s = String(hiresUrl ?? "").trim();
  if (!s) {
    return null;
  }
  if (s.toLowerCase().startsWith(DNC_PRODUCT_PREFIX.toLowerCase())) {
    return s;
  }
  if (s.toLowerCase().startsWith(DNC_HIRES_PREFIX.toLowerCase())) {
    return `${DNC_PRODUCT_PREFIX}${encodeURIComponent(filenameFromDncUrl(s))}`;
  }
  const m = /\/images\/hires\/(.+)$/i.exec(s);
  if (m?.[1]) {
    return `${DNC_PRODUCT_PREFIX}${m[1]}`;
  }
  return null;
}

export function dncDownloadUrlForSource(hiresOrExternalUrl, source = "product") {
  const raw = String(hiresOrExternalUrl ?? "").trim();
  if (!raw) {
    return null;
  }
  if (source === "hires") {
    if (raw.toLowerCase().includes("/images/hires/")) {
      return raw;
    }
    const name = filenameFromDncUrl(raw);
    return name ? `${DNC_HIRES_PREFIX}${encodeURIComponent(name)}` : null;
  }
  return dncProductImageUrlFromHires(raw) ?? raw;
}

export function dncStorageObjectPath(filename, source = "product") {
  const name = String(filename ?? "").trim().replace(/\\/g, "/").split("/").pop() ?? "";
  if (!name) {
    return null;
  }
  const folder = source === "hires" ? "hires" : "product";
  return `${SUPPLIER_FOLDER}/${folder}/${name}`.replace(/\/+/g, "/");
}

export function dncSupplierMediaUrl(objectPath) {
  const p = String(objectPath ?? "").trim().replace(/^\/+/, "");
  if (!p) {
    return null;
  }
  const enc = p
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${MEDIA_API_PREFIX}${enc}`;
}

export function mimeFromFilename(name) {
  const lower = String(name ?? "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export function rewriteDncImageUrls(urls, urlMap) {
  if (!Array.isArray(urls)) {
    return urls;
  }
  let changed = false;
  const next = urls.map((raw) => {
    const u = String(raw ?? "").trim();
    if (!u) {
      return raw;
    }
    if (isDncMigratedMediaUrl(u)) {
      return u;
    }
    const mapped = urlMap.get(u);
    if (mapped) {
      changed = true;
      return mapped;
    }
    return raw;
  });
  return changed ? next : null;
}

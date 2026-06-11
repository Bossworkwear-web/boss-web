/** DNC Workwear colour ↔ image helpers (storefront PDP). */

export function dncImageFilenameFromUrl(url: string): string {
  const s = String(url ?? "").trim();
  if (!s) {
    return "";
  }
  let tail = s.split("/").pop() ?? s;
  try {
    tail = decodeURIComponent(tail);
  } catch {
    // keep encoded tail
  }
  return (tail.split("?")[0] ?? tail).trim();
}

export function dncIsColorProductImageFilename(filename: string, styleCode: string): boolean {
  const base = String(filename ?? "").replace(/\.[^.]+$/i, "");
  const style = String(styleCode ?? "").trim();
  if (!style || !base.startsWith(style)) {
    return false;
  }
  const rest = base.slice(style.length);
  return /^\d{3}$/.test(rest);
}

export function dncStyleCodeFromSlug(slug: string | null | undefined): string | null {
  const m = /^dnc-([a-z0-9]+)$/i.exec(String(slug ?? "").trim().toLowerCase());
  return m?.[1] ?? null;
}

export const DNC_GALLERY_PREFIX_HASH_RE = /#dncc=(\d+)$/i;

export function parseDncPrefixCountFromFirstImageUrl(imageUrls: readonly string[]): number {
  const first = typeof imageUrls?.[0] === "string" ? imageUrls[0] : "";
  const m = DNC_GALLERY_PREFIX_HASH_RE.exec(first);
  if (!m?.[1]) {
    return 0;
  }
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function stripDncGalleryPrefixHash(url: string): string {
  const s = String(url ?? "");
  const m = DNC_GALLERY_PREFIX_HASH_RE.exec(s);
  if (m?.index == null) {
    return s;
  }
  return s.slice(0, m.index);
}

export function dncInferPrefixCountFromGallery(
  imageUrls: readonly string[],
  styleCode: string | null,
  colorCount: number,
): number {
  const style = String(styleCode ?? "").trim();
  if (!style || colorCount < 2) {
    return 0;
  }
  let n = 0;
  for (let i = 0; i < Math.min(imageUrls.length, colorCount); i += 1) {
    const fn = dncImageFilenameFromUrl(imageUrls[i] ?? "");
    if (!dncIsColorProductImageFilename(fn, style)) {
      break;
    }
    n += 1;
  }
  return n >= 2 && n === colorCount ? n : 0;
}

export function isDncWorkwearStorefrontProduct(
  slug: string | null | undefined,
  supplierName: string | null | undefined,
): boolean {
  const s = String(slug ?? "").trim().toLowerCase();
  if (s.startsWith("dnc-")) {
    return true;
  }
  const sup = String(supplierName ?? "").trim().toLowerCase();
  return sup === "dnc workwear" || sup === "dnc";
}

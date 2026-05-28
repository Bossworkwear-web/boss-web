import {
  apColorImageCountsAlignWithColors,
  apHeroIndexForColor,
  stripApGalleryColorCountsHash,
} from "@/lib/ap-gallery-color-counts";
import type { QuoteCatalogProduct } from "@/lib/quote-catalog-products";
import { resolveStorefrontImageUrl } from "@/lib/storefront-image-url";

const JB_GALLERY_PREFIX_HASH_RE = /#jbpc=(\d+)$/i;

function parseQuoteGalleryUrls(raw: readonly string[]): {
  urls: string[];
  prefixCount: number;
  apColorImageCounts: number[] | null;
} {
  if (!raw.length) {
    return { urls: [], prefixCount: 0, apColorImageCounts: null };
  }

  let apColorImageCounts: number[] | null = null;
  const withApccStripped = raw.map((url, index) => {
    if (index !== 0 || typeof url !== "string") {
      return url;
    }
    const stripped = stripApGalleryColorCountsHash(url);
    apColorImageCounts = stripped.counts;
    return stripped.url;
  });

  let prefixCount = 0;
  const urls = withApccStripped
    .map((url) => {
      const value = typeof url === "string" ? url : "";
      const match = JB_GALLERY_PREFIX_HASH_RE.exec(value);
      if (match) {
        const count = Number.parseInt(match[1] ?? "", 10);
        if (Number.isFinite(count) && count > 0) {
          prefixCount = count;
        }
        return value.slice(0, match.index);
      }
      return value;
    })
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  return { urls, prefixCount, apColorImageCounts };
}

function colorOptionIndex(colors: readonly string[], color: string): number {
  const target = color.trim().toLowerCase();
  return colors.findIndex((entry) => entry.trim().toLowerCase() === target);
}

function compactColorKey(label: string): string {
  return label.trim().toLowerCase().replace(/[\s/_-]+/g, "");
}

function isJbWearProduct(product: QuoteCatalogProduct): boolean {
  const slug = (product.slug ?? "").trim().toLowerCase();
  if (slug.startsWith("jb-")) {
    return true;
  }
  return /\bjb'?s\s*wear\b/i.test(product.name);
}

function resolveImageUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  return resolveStorefrontImageUrl(trimmed) || trimmed;
}

function pickImageByFilename(colors: readonly string[], urls: readonly string[], colorIdx: number): string | null {
  const label = colors[colorIdx]?.trim();
  if (!label) {
    return null;
  }

  const parts = label
    .split(/\s*\/\s*/)
    .map((part) => compactColorKey(part))
    .filter((part) => part.length > 1);

  if (parts.length >= 2) {
    let bestUrl: string | null = null;
    let bestScore = 0;
    for (const url of urls) {
      const haystack = compactColorKey(url);
      const score = parts.filter((part) => haystack.includes(part)).length;
      if (score > bestScore) {
        bestScore = score;
        bestUrl = url;
      }
    }
    if (bestUrl && bestScore >= 2) {
      return bestUrl;
    }
  }

  const want = compactColorKey(label);
  if (want.length < 3) {
    return null;
  }

  for (const url of urls) {
    if (compactColorKey(url).includes(want)) {
      return url;
    }
  }

  return null;
}

/** Small quote-line preview image for the selected product colour. */
export function quoteProductImageForColor(product: QuoteCatalogProduct, color: string): string | null {
  const trimmedColor = color.trim();
  if (!trimmedColor || product.imageUrls.length === 0) {
    return null;
  }

  const { urls, prefixCount, apColorImageCounts } = parseQuoteGalleryUrls(product.imageUrls);
  if (urls.length === 0) {
    return null;
  }

  const colors = product.availableColors;
  const colorIdx = colorOptionIndex(colors, trimmedColor);
  if (colorIdx < 0) {
    return resolveImageUrl(urls[0]);
  }

  if (apColorImageCountsAlignWithColors(apColorImageCounts, colors.length)) {
    const heroIdx = apHeroIndexForColor(colorIdx, apColorImageCounts);
    if (heroIdx != null && heroIdx >= 0 && heroIdx < urls.length) {
      return resolveImageUrl(urls[heroIdx]);
    }
  }

  if (isJbWearProduct(product) && prefixCount > 0 && colorIdx < prefixCount && colorIdx < urls.length) {
    return resolveImageUrl(urls[colorIdx]);
  }

  if (urls.length === colors.length && colorIdx < urls.length) {
    return resolveImageUrl(urls[colorIdx]);
  }

  if (colors.length > 1 && urls.length > colors.length) {
    const stride = Math.max(1, Math.floor(urls.length / colors.length));
    const idx = Math.min(colorIdx * stride, urls.length - 1);
    return resolveImageUrl(urls[idx]);
  }

  const filenameMatch = pickImageByFilename(colors, urls, colorIdx);
  if (filenameMatch) {
    return resolveImageUrl(filenameMatch);
  }

  return resolveImageUrl(urls[0]);
}

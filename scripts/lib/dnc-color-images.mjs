/**
 * DNC Workwear colour ↔ image helpers.
 *
 * Variant SKUs encode a 3-digit colour code after the style code (e.g. 386435763 → 3864 + 357 + 63).
 * Product images use the same prefix: 3864357.jpg → style 3864 + colour 357.
 */

export function dncImageFilenameFromUrl(url) {
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

export function dncExtractColorCodeFromVariant(styleCode, variantCode) {
  const style = String(styleCode ?? "").trim();
  const sku = String(variantCode ?? "").trim();
  if (!style || !sku.startsWith(style) || sku.length <= style.length) {
    return null;
  }
  const rest = sku.slice(style.length);
  if (/^\d{5,}$/.test(rest)) {
    return rest.slice(0, 3);
  }
  if (/^\d{3}$/.test(rest)) {
    return rest;
  }
  return null;
}

export function dncIsColorProductImageFilename(filename, styleCode) {
  const base = String(filename ?? "").replace(/\.[^.]+$/i, "");
  const style = String(styleCode ?? "").trim();
  if (!style || !base.startsWith(style)) {
    return false;
  }
  const rest = base.slice(style.length);
  return /^\d{3}$/.test(rest);
}

export function dncStyleCodeFromSlug(slug) {
  const m = /^dnc-([a-z0-9]+)$/i.exec(String(slug ?? "").trim().toLowerCase());
  return m?.[1] ?? null;
}

export const DNC_GALLERY_PREFIX_HASH_RE = /#dncc=(\d+)$/i;

export function parseDncPrefixCountFromFirstImageUrl(imageUrls) {
  const first = typeof imageUrls?.[0] === "string" ? imageUrls[0] : "";
  const m = DNC_GALLERY_PREFIX_HASH_RE.exec(first);
  if (!m?.[1]) {
    return 0;
  }
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function stripDncGalleryPrefixHash(url) {
  const s = String(url ?? "");
  const m = DNC_GALLERY_PREFIX_HASH_RE.exec(s);
  if (!m?.index && m?.index !== 0) {
    return s;
  }
  return s.slice(0, m.index);
}

/**
 * Infer positional colour↔image count when `#dncc=` is absent but leading images are
 * colour-coded filenames (one per chip).
 */
export function dncInferPrefixCountFromGallery(imageUrls, styleCode, colorCount) {
  const style = String(styleCode ?? "").trim();
  if (!style || colorCount < 2) {
    return 0;
  }
  let n = 0;
  for (let i = 0; i < Math.min(imageUrls.length, colorCount); i += 1) {
    const fn = dncImageFilenameFromUrl(imageUrls[i]);
    if (!dncIsColorProductImageFilename(fn, style)) {
      break;
    }
    n += 1;
  }
  return n >= 2 && n === colorCount ? n : 0;
}

/**
 * Order `available_colors` and `image_urls` so the first N gallery images align with colour chips.
 */
export function buildDncColorGallery(group) {
  const colorToUrls = group.colorToUrls ?? new Map();
  const colorCodes = group.colorCodes ?? new Map();
  const styleCode = group.styleCode;
  const allImageUrls = group.imageUrls instanceof Set ? [...group.imageUrls] : [...(group.imageUrls ?? [])];

  if (colorToUrls.size === 0) {
    const colors = [...(group.colors ?? [])].sort((a, b) => a.localeCompare(b));
    return {
      colors,
      image_urls: allImageUrls,
      dncPrefixCount: 0,
    };
  }

  const colorEntries = [...colorToUrls.entries()].map(([color, urlSet]) => {
    const urls = [...urlSet];
    const coded = urls.find((u) =>
      dncIsColorProductImageFilename(dncImageFilenameFromUrl(u), styleCode),
    );
    return {
      color,
      code: colorCodes.get(color) ?? "999",
      primaryUrl: coded ?? urls[0] ?? null,
    };
  });

  colorEntries.sort((a, b) => {
    const na = Number.parseInt(a.code, 10);
    const nb = Number.parseInt(b.code, 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
      return na - nb;
    }
    return a.code.localeCompare(b.code) || a.color.localeCompare(b.color);
  });

  const colors = colorEntries.map((e) => e.color);
  const primaryImages = colorEntries.map((e) => e.primaryUrl).filter(Boolean);
  const primarySet = new Set(primaryImages);
  const extras = allImageUrls.filter((u) => !primarySet.has(u));
  const image_urls = [...primaryImages, ...extras];

  const dncPrefixCount =
    colors.length > 0 && primaryImages.length === colors.length ? colors.length : 0;

  if (dncPrefixCount > 0 && image_urls[0]) {
    const first = stripDncGalleryPrefixHash(image_urls[0]);
    image_urls[0] = `${first}#dncc=${dncPrefixCount}`;
  }

  return { colors, image_urls, dncPrefixCount };
}

/**
 * Remap newly ordered hires URLs onto existing stored media URLs (preserves `?v=zoom1` etc.).
 */
export function remapDncImageOrder(newOrderedUrls, existingUrls) {
  const existingByBasename = new Map();
  for (const u of existingUrls) {
    const base = dncImageFilenameFromUrl(u).toLowerCase();
    if (base) {
      existingByBasename.set(base, u);
    }
  }

  const mapped = [];
  const mappedSet = new Set();
  for (const newUrl of newOrderedUrls) {
    const base = dncImageFilenameFromUrl(stripDncGalleryPrefixHash(newUrl)).toLowerCase();
    const hit = existingByBasename.get(base);
    if (hit && !mappedSet.has(hit)) {
      mapped.push(hit);
      mappedSet.add(hit);
    }
  }

  for (const u of existingUrls) {
    if (!mappedSet.has(u)) {
      mapped.push(u);
    }
  }

  const dncPrefixCount = parseDncPrefixCountFromFirstImageUrl(newOrderedUrls);
  if (dncPrefixCount > 0 && mapped[0]) {
    const first = stripDncGalleryPrefixHash(mapped[0]);
    mapped[0] = `${first}#dncc=${dncPrefixCount}`;
  }

  return mapped;
}

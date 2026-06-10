const DNC_PRODUCT_BASE = "https://www.dncworkwear.com.au/Product/";

function decodeHtmlEntities(text) {
  return String(text ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlFragmentToPlainText(html) {
  let s = String(html ?? "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeHtmlEntities(s);
  return s
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function featureLabelFromImageSrc(src) {
  const file = String(src ?? "")
    .split("/")
    .pop()
    ?.replace(/\.[a-z0-9]+$/i, "")
    ?.trim();
  if (!file) {
    return null;
  }
  return file
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse DNC public product page HTML into storefront `description` + `features` text.
 * @returns {{ description: string, features: string, productTitle: string | null } | null}
 */
export function parseDncProductPageHtml(html, styleCode) {
  if (!html || !String(html).includes("ProductDetailInfoArea")) {
    return null;
  }

  const areaMatch = html.match(/<section class="ProductDetailInfoArea">([\s\S]*?)<\/section>/i);
  if (!areaMatch?.[1]) {
    return null;
  }
  const area = areaMatch[1];

  const titleMatch = area.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const productTitle = titleMatch?.[1] ? htmlFragmentToPlainText(titleMatch[1]) : null;

  const bodyMatch = area.match(
    /<h4>\s*Product Code:\s*[^<]*<\/h4>\s*<p>([\s\S]*?)<\/p>\s*<ul class="ProductDetailOptions"/i,
  );

  const descriptionLines = [];
  if (bodyMatch?.[1]) {
    const chunks = bodyMatch[1].split(/<\/p>/i);
    for (const chunk of chunks) {
      const text = htmlFragmentToPlainText(chunk);
      if (text) {
        descriptionLines.push(text);
      }
    }
  }

  const description = descriptionLines.join("\n").trim();
  if (!description) {
    return null;
  }

  const iconsMatch = html.match(/<ul class="ProductDetailOptionIcons">([\s\S]*?)<\/ul>/i);
  const featureBullets = [];
  const seen = new Set();
  if (iconsMatch?.[1]) {
    const iconBlocks = iconsMatch[1].match(/<li[\s\S]*?<\/li>/gi) ?? [];
    for (const block of iconBlocks) {
      const titleMatchInner = /\btitle="([^"]*)"/i.exec(block);
      const altMatchInner = /\balt="([^"]*)"/i.exec(block);
      const srcMatchInner = /\bsrc="([^"]*)"/i.exec(block);
      const detail = (titleMatchInner?.[1] ?? altMatchInner?.[1] ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (!detail || seen.has(detail)) {
        continue;
      }
      seen.add(detail);
      const label = featureLabelFromImageSrc(srcMatchInner?.[1]) ?? "Feature";
      featureBullets.push(`${label}: ${detail}`);
    }
  }

  return {
    styleCode: String(styleCode ?? "").trim(),
    productTitle,
    description,
    features: featureBullets.join("\n\n").trim(),
  };
}

export function dncProductPageUrl(styleCode) {
  const code = encodeURIComponent(String(styleCode ?? "").trim());
  return `${DNC_PRODUCT_BASE}${code}`;
}

export async function fetchDncProductPage(styleCode, { signal } = {}) {
  const url = dncProductPageUrl(styleCode);
  const res = await fetch(url, {
    signal,
    headers: {
      "User-Agent": "BossWorkwearCatalogSync/1.0 (+https://bossworkwear.au)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

export function styleCodeFromDncSlug(slug) {
  const m = /^dnc-(.+)$/i.exec(String(slug ?? "").trim());
  return m?.[1] ? m[1].trim() : null;
}

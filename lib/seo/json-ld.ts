/**
 * schema.org JSON-LD builders for SEO rich results.
 * Render the returned objects via `<JsonLd data={...} />` (app/components/json-ld.tsx).
 */
import { SITE_STORE_ADDRESS_LINES, siteFacebookUrl, siteInstagramUrl } from "@/lib/site-footer";
import { getSiteUrl } from "@/lib/site-url";

export const SEO_SITE_NAME = "Boss Workwear";
export const SEO_ORG_ID_FRAGMENT = "#organization";

/** Make a relative path absolute against the canonical site origin (no-op for full URLs). */
export function absoluteUrl(pathOrUrl: string | null | undefined): string {
  const v = (pathOrUrl ?? "").trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:")) {
    return v;
  }
  const base = getSiteUrl().replace(/\/$/, "");
  return v.startsWith("/") ? `${base}${v}` : `${base}/${v}`;
}

/** Best-effort parse of the configured store address lines into a PostalAddress. */
function storePostalAddress() {
  const lines = [...SITE_STORE_ADDRESS_LINES];
  const street = lines[0] ?? "";
  const localityLine = lines[1] ?? "";
  // e.g. "Morley, WA 6062"
  const m = localityLine.match(/^(.+?),\s*([A-Za-z]{2,3})\s*(\d{4})\s*$/);
  return {
    "@type": "PostalAddress",
    ...(street ? { streetAddress: street } : {}),
    ...(m ? { addressLocality: m[1].trim(), addressRegion: m[2].trim(), postalCode: m[3].trim() } : {}),
    addressCountry: "AU",
  };
}

/** Organization / physical store node (referenced by WebSite + Product offers via @id). */
export function organizationJsonLd() {
  const url = getSiteUrl();
  const sameAs = [siteFacebookUrl, siteInstagramUrl].map((s) => s.trim()).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    "@id": `${url}/${SEO_ORG_ID_FRAGMENT}`,
    name: SEO_SITE_NAME,
    url,
    logo: absoluteUrl("/Boss_favicon.svg"),
    image: absoluteUrl("/Boss_favicon.svg"),
    description:
      "Professional workwear, uniforms, embroidery and printing for teams across Australia — corporate polos, medical scrubs, PPE and more.",
    address: storePostalAddress(),
    areaServed: { "@type": "Country", name: "Australia" },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** WebSite node with a Sitelinks search box (SearchAction → /search?q=). */
export function webSiteJsonLd() {
  const url = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${url}/#website`,
    name: SEO_SITE_NAME,
    url,
    publisher: { "@id": `${url}/${SEO_ORG_ID_FRAGMENT}` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${url}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Breadcrumb trail. Each item needs a display name and a (relative or absolute) URL. */
export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items
      .filter((it) => it.name?.trim())
      .map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name.trim(),
        item: absoluteUrl(it.url),
      })),
  };
}

export type ProductJsonLdInput = {
  name: string;
  description: string;
  /** Relative (e.g. /products/foo) or absolute canonical URL. */
  url: string;
  images: string[];
  sku?: string | null;
  brand?: string | null;
  /** Current price (GST incl.), AUD. */
  price: number;
  priceCurrency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  rating?: { value: number; count: number } | null;
};

/** Product node with an Offer (price/availability) and optional aggregateRating. */
export function productJsonLd(input: ProductJsonLdInput) {
  const url = absoluteUrl(input.url);
  const images = input.images.map(absoluteUrl).filter(Boolean);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(input.sku ? { sku: input.sku, mpn: input.sku } : {}),
    ...(input.brand ? { brand: { "@type": "Brand", name: input.brand } } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: input.priceCurrency ?? "AUD",
      price: (Number.isFinite(input.price) ? Math.max(0, input.price) : 0).toFixed(2),
      availability: `https://schema.org/${input.availability ?? "InStock"}`,
      seller: { "@id": `${getSiteUrl()}/${SEO_ORG_ID_FRAGMENT}` },
    },
  };
  if (input.rating && input.rating.count > 0 && input.rating.value > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.round(input.rating.value * 10) / 10,
      reviewCount: Math.max(1, Math.round(input.rating.count)),
    };
  }
  return data;
}

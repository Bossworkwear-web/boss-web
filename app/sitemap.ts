import type { MetadataRoute } from "next";

import { getCachedActiveProductsBrowseRows } from "@/lib/cached-storefront-products";
import { MAIN_CATEGORIES, getSubCategoriesForMain } from "@/lib/catalog";
import { productPathSegment } from "@/lib/product-path-slug";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const staticPaths = [
    "",
    "/quote",
    "/service",
    "/special-deals",
    "/contact-us",
    "/terms-and-conditions",
    "/privacy-policy",
    "/returns-policy",
    "/shipping-policy",
    "/search",
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "monthly",
    priority: path === "" ? 1 : path === "/quote" ? 0.85 : 0.7,
  }));

  for (const main of MAIN_CATEGORIES) {
    entries.push({
      url: `${base}/categories/${main.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    });
    for (const sub of getSubCategoriesForMain(main.slug)) {
      entries.push({
        url: `${base}/categories/${main.slug}/${sub.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }
  }

  // Product detail pages — the highest-value URLs for organic discovery.
  try {
    const rows = await getCachedActiveProductsBrowseRows();
    const seen = new Set<string>();
    for (const row of rows) {
      const name = String(row?.name ?? "").trim();
      if (!name) {
        continue;
      }
      const segment = productPathSegment({ name, slug: row?.slug ?? null });
      if (!segment || seen.has(segment)) {
        continue;
      }
      seen.add(segment);
      entries.push({
        url: `${base}/products/${encodeURIComponent(segment)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // If the catalogue can't be loaded, still return the static + category sitemap.
  }

  return entries;
}

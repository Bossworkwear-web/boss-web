import type { MetadataRoute } from "next";

import { MAIN_CATEGORIES, getSubCategoriesForMain } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  const staticPaths = [
    "",
    "/service",
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
    priority: path === "" ? 1 : 0.7,
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

  return entries;
}

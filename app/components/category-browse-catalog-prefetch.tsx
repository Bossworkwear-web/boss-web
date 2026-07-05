"use client";

import { useEffect } from "react";

import { prefetchStorefrontBrowseCatalogClient } from "@/lib/storefront-browse-catalog-client";

/** Start loading the browse catalog as soon as the user enters any category route. */
export function CategoryBrowseCatalogPrefetch() {
  useEffect(() => {
    prefetchStorefrontBrowseCatalogClient();
  }, []);
  return null;
}

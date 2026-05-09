import { TopNavClient } from "@/app/components/top-nav-client";
import { buildNavSubcategoriesByMain, MAIN_CATEGORIES } from "@/lib/catalog";

/**
 * Server wrapper: subcategory lists are computed once per request and passed into the client nav so
 * SSR HTML matches hydration (avoids Turbopack/HMR drift between server and client `catalog` bundles).
 */
export function TopNav() {
  const navSubsByMain = buildNavSubcategoriesByMain();
  const mainCategories = MAIN_CATEGORIES.map((c) => ({ slug: c.slug, label: c.label }));
  return <TopNavClient navSubsByMain={navSubsByMain} mainCategories={mainCategories} />;
}

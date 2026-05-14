import { CategoryTopAdBanner } from "@/app/components/category-top-ad-banner";

/** Shown at the top of `/categories/womens` and `/categories/womens/*` only. */
export function WomensCategoryTopAd() {
  return <CategoryTopAdBanner src="/Ad_women's.png" alt="Women's — promotional banner" />;
}

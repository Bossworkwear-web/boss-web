import { CategoryTopAdBanner } from "@/app/components/category-top-ad-banner";

/** Shown at the top of `/categories/kids` and `/categories/kids/*` only. */
export function KidsCategoryTopAd() {
  return <CategoryTopAdBanner src="/Ad_kid's.png" alt="Kid's — promotional banner" />;
}

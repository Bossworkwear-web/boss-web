import { CategoryTopAdBanner } from "@/app/components/category-top-ad-banner";

/** Shown at the top of `/categories/ppe` and `/categories/ppe/*` only. */
export function PpeCategoryTopAd() {
  return <CategoryTopAdBanner src="/Ad_PPE.png" alt="PPE — promotional banner" />;
}

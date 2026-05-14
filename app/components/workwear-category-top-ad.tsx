import { CategoryTopAdBanner } from "@/app/components/category-top-ad-banner";

/** Shown at the top of `/categories/workwear` and `/categories/workwear/*` only. */
export function WorkwearCategoryTopAd() {
  return <CategoryTopAdBanner src="/Ad_workwear.png" alt="Workwear — promotional banner" />;
}

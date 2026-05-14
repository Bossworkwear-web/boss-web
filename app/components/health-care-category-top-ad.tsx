import { CategoryTopAdBanner } from "@/app/components/category-top-ad-banner";

/** Shown at the top of `/categories/health-care` and `/categories/health-care/*` only. */
export function HealthCareCategoryTopAd() {
  return (
    <CategoryTopAdBanner src="/Ad_Health%20care%20.png" alt="Health care — promotional banner" />
  );
}

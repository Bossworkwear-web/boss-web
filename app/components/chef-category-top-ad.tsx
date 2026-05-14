import { CategoryTopAdBanner } from "@/app/components/category-top-ad-banner";

/** Shown at the top of `/categories/chef` and `/categories/chef/*` only. */
export function ChefCategoryTopAd() {
  return <CategoryTopAdBanner src="/Ad_chef.png" alt="Chef — promotional banner" />;
}

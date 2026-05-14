import { CategoryTopAdBanner } from "@/app/components/category-top-ad-banner";

/** Shown at the top of `/categories/mens` and `/categories/mens/*` only. */
export function MensCategoryTopAd() {
  return (
    <CategoryTopAdBanner
      src="/Ad_men's.png"
      alt="Men's — promotional banner"
      waOwnedMarkSrc="/WA-Owned_white.png"
    />
  );
}

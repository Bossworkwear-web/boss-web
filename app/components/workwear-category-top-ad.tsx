import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

/** Shown at the top of `/categories/workwear` and `/categories/workwear/*` only. */
export function WorkwearCategoryTopAd() {
  return (
    <div className={`${SITE_PAGE_ROW_CLASS} pb-6 pt-4 sm:pb-8 sm:pt-5`}>
      <aside
        className="overflow-hidden rounded-xl border border-brand-navy/10 bg-white shadow-sm"
        aria-label="Promotion"
      >
        <img
          src="/Glasses_AD.jpg"
          alt="Safety glasses — promotional offer"
          className="block h-auto w-full bg-white object-contain"
          decoding="async"
        />
      </aside>
    </div>
  );
}

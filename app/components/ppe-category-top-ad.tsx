import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

/** Shown at the top of `/categories/ppe` and `/categories/ppe/*` only. */
export function PpeCategoryTopAd() {
  return (
    <div className={`${SITE_PAGE_ROW_CLASS} pb-3 pt-4 sm:pb-4 sm:pt-5`}>
      <aside
        className="overflow-hidden rounded-xl border border-brand-navy/10 bg-white shadow-sm"
        aria-label="Promotion"
      >
        <img
          src="/Ad_PPE.png"
          alt="PPE — promotional banner"
          className="block h-auto w-full bg-white object-contain"
          decoding="async"
        />
      </aside>
    </div>
  );
}


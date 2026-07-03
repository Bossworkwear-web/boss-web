import { QuoteGuideModal } from "@/app/components/quote-guide-modal";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { CATEGORY_BROWSE_GRID_CLASS, CATEGORY_BROWSE_PAGE_SIZE } from "@/lib/main-category-browse";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

const PLACEHOLDER_CARD_COUNT = CATEGORY_BROWSE_PAGE_SIZE;

function CategoryBrowseCardPlaceholder({ index }: { index: number }) {
  return (
    <div
      aria-hidden
      className="flex w-full min-w-0 flex-col overflow-hidden rounded-[1.2rem] border border-brand-navy/10 bg-white shadow-sm"
    >
      <div className="subcategory-browse-card-media relative flex w-full shrink-0 items-center justify-center overflow-hidden border-b border-brand-navy/10 bg-brand-surface/60 px-[0.9rem] py-[0.9rem]">
        <div className="aspect-square w-full max-w-[10rem] rounded-lg bg-brand-navy/8" />
      </div>
      <div className="subcategory-browse-card-body min-w-0 space-y-2 px-3 py-3">
        <div className="mx-auto h-4 w-4/5 rounded bg-brand-navy/8" />
        <div className="mx-auto h-3 w-3/5 rounded bg-brand-navy/6" />
      </div>
      <span className="sr-only">Loading product {index + 1}</span>
    </div>
  );
}

/** Instant category browse shell while the server grid loads. */
export function CategoryBrowseLoadingShell({ variant = "main" }: { variant?: "main" | "sub" }) {
  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy" aria-busy="true">
      <TopNav />
      <QuoteGuideModal />
      <MainWithSupplierRail>
        <section className={`category-browse-panel relative z-10 ${SITE_PAGE_ROW_CLASS} pb-10 pt-0`}>
          <header className="mb-7 mt-10 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">Category</p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="h-10 w-48 max-w-full rounded-lg bg-brand-navy/8" aria-hidden />
              <div className="h-10 w-36 rounded-lg bg-brand-navy/6" aria-hidden />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full max-w-md rounded bg-brand-navy/6" aria-hidden />
              <div className="h-4 w-full max-w-sm rounded bg-brand-navy/5" aria-hidden />
            </div>
            {variant === "sub" ? (
              <div className="flex flex-wrap gap-2" aria-hidden>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="h-9 w-24 rounded-full bg-brand-navy/6" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2" aria-hidden>
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="h-9 w-28 rounded-full bg-brand-navy/6" />
                ))}
              </div>
            )}
          </header>

          <div className={CATEGORY_BROWSE_GRID_CLASS}>
            {Array.from({ length: PLACEHOLDER_CARD_COUNT }, (_, index) => (
              <CategoryBrowseCardPlaceholder key={index} index={index} />
            ))}
          </div>
        </section>
      </MainWithSupplierRail>
    </main>
  );
}

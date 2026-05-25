import Link from "next/link";

/** CTA block at the top of storefront category browse pages — overlaps hero bottom by half on sm+. */
export function CategoryGetAQuoteCta() {
  return (
    <div className="category-quote-cta-shell relative z-30 mt-[7mm] flex flex-col items-center gap-2 overflow-visible pb-3 sm:-mt-[22px]">
      <Link
        href="/quote"
        data-cyber-guide="cat-quote"
        className="relative z-30 inline-flex min-h-[calc(34px*0.91)] min-w-[calc(12rem*0.91)] max-w-full cursor-pointer items-center justify-center rounded-full bg-brand-orange px-[calc(1.25rem*0.91)] py-[calc(0.5rem*0.91)] text-center text-[calc(0.9rem*0.91)] font-bold uppercase leading-tight tracking-[0.08em] text-white shadow-sm transition-colors duration-200 ease-out hover:bg-brand-navy hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange sm:min-h-[44px] sm:min-w-[15.6rem] sm:px-9 sm:py-2.5 sm:text-[1.37rem]"
      >
        Free Quote
      </Link>
      <p className="relative z-30 max-w-md px-4 text-center text-[calc(0.75rem*1.3)] font-medium leading-snug text-brand-navy/75 sm:max-w-lg sm:text-[calc(0.875rem*1.3)]">
        Ordering 50+ units? Get a better deal with a free quote.
      </p>
    </div>
  );
}

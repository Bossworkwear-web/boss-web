import Link from "next/link";

/** CTA block at the top of storefront category browse pages — overlaps hero bottom by half on sm+. */
export function CategoryGetAQuoteCta() {
  return (
    <div className="category-quote-cta-shell relative z-30 mt-[7mm] flex justify-center overflow-visible pb-3 sm:-mt-[17px]">
      <Link
        href="/quote"
        data-cyber-guide="cat-quote"
        className="relative z-30 inline-flex min-h-[calc(34px*0.7)] min-w-[calc(12rem*0.7)] max-w-full cursor-pointer items-center justify-center rounded-full bg-brand-orange px-[calc(1.25rem*0.7)] py-[calc(0.5rem*0.7)] text-center text-[calc(0.9rem*0.7)] font-bold uppercase leading-tight tracking-[0.08em] text-white shadow-sm transition-colors duration-200 ease-out hover:bg-brand-navy hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange sm:min-h-[34px] sm:min-w-[12rem] sm:px-7 sm:py-2 sm:text-[1.05rem]"
      >
        Free Quote
      </Link>
    </div>
  );
}

import { storefrontQuoteEnquiryMailtoHref } from "@/lib/storefront-quote-mailto";

/** CTA block at the top of storefront category browse pages — overlaps hero bottom by half (translate −50%). */
export function CategoryGetAQuoteCta() {
  return (
    <div className="mt-[7mm] flex justify-center pb-3 sm:mt-0">
      <a
        href={storefrontQuoteEnquiryMailtoHref()}
        className="relative z-20 inline-flex min-h-[calc(34px*0.7)] min-w-[calc(12rem*0.7)] max-w-full cursor-pointer items-center justify-center rounded-full bg-brand-orange px-[calc(1.25rem*0.7)] py-[calc(0.5rem*0.7)] text-center text-[calc(0.9rem*0.7)] font-bold uppercase leading-tight tracking-[0.08em] text-white shadow-sm transition-colors duration-200 ease-out hover:bg-brand-navy hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange sm:min-h-[34px] sm:min-w-[12rem] sm:-translate-y-1/2 sm:px-7 sm:py-2 sm:text-[1.05rem]"
      >
        Email for a free quote
      </a>
    </div>
  );
}

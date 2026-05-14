import { storefrontQuoteEnquiryMailtoHref } from "@/lib/storefront-quote-mailto";

/** CTA block at the top of storefront category browse pages — overlaps hero bottom by half (translate −50%). */
export function CategoryGetAQuoteCta() {
  return (
    <div className="flex justify-center pb-3">
      <a
        href={storefrontQuoteEnquiryMailtoHref()}
        className="relative z-20 inline-flex min-h-[34px] min-w-[12rem] max-w-full -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-brand-orange px-5 py-2 text-center text-[0.9rem] font-bold uppercase leading-tight tracking-[0.08em] text-white shadow-sm transition-colors duration-200 ease-out hover:bg-brand-navy hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange sm:px-7 sm:text-[1.05rem]"
      >
        Email for a free quote
      </a>
    </div>
  );
}

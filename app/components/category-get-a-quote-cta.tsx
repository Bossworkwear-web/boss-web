import { storefrontQuoteEnquiryMailtoHref } from "@/lib/storefront-quote-mailto";

/** CTA row at the top of storefront category browse pages — opens the customer’s email app. */
export function CategoryGetAQuoteCta() {
  return (
    <div className="pb-3">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:gap-y-3">
        <p className="order-1 text-center text-[1.05rem] font-semibold leading-snug text-brand-navy sm:order-none sm:min-w-0 sm:flex-1 sm:text-right sm:text-[1.125rem]">
          Buy in bulk?
        </p>
        <div className="order-2 flex w-full shrink-0 justify-center sm:order-none sm:w-auto">
          <a
            href={storefrontQuoteEnquiryMailtoHref()}
            className="inline-flex min-h-[34px] min-w-[12rem] max-w-full items-center justify-center rounded-full bg-brand-orange px-5 py-2 text-center text-[1.125rem] font-bold uppercase leading-tight tracking-[0.08em] text-white shadow-sm transition hover:bg-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange sm:px-7 sm:text-[1.3125rem]"
          >
            Email for a free quote
          </a>
        </div>
        <p className="order-3 text-center text-[1.05rem] font-semibold leading-snug text-brand-navy sm:order-none sm:min-w-0 sm:flex-1 sm:text-left sm:text-[1.125rem]">
          Can&apos;t find your item?
        </p>
      </div>
    </div>
  );
}

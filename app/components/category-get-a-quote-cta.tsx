import { storefrontQuoteEnquiryMailtoHref } from "@/lib/storefront-quote-mailto";

/** Centered CTA shown at the top of storefront category browse pages — opens the customer’s email app. */
export function CategoryGetAQuoteCta() {
  return (
    <div className="flex justify-center pb-6">
      <a
        href={storefrontQuoteEnquiryMailtoHref()}
        className="inline-flex min-h-[48px] min-w-[12rem] items-center justify-center rounded-full bg-brand-orange px-8 py-3 text-center text-[1.3125rem] font-bold uppercase leading-tight tracking-[0.08em] text-white shadow-sm transition hover:bg-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
      >
        Email for a free quote
      </a>
    </div>
  );
}

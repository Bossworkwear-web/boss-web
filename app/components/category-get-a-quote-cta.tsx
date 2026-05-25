import { StorefrontDualCta } from "@/app/components/storefront-dual-cta";

/** CTA block at the top of storefront category browse pages — overlaps hero bottom by half on sm+. */
export function CategoryGetAQuoteCta() {
  return (
    <div className="category-quote-cta-shell mt-[7mm] flex flex-col items-center gap-2 overflow-visible pb-3 sm:mt-[-17px]">
      <StorefrontDualCta variant="category" shopHref="#category-products" quoteHref="/quote" />
      <p className="relative z-20 max-w-md px-4 text-center text-xs text-brand-navy/65 sm:text-sm">
        Order online for small teams, or request a quote for 20+ units with logo embroidery or printing.
      </p>
    </div>
  );
}

import Link from "next/link";

import type { StorefrontSpecialDeal } from "@/lib/storefront-special-deals";

const cardClass =
  "flex h-full flex-col overflow-hidden rounded-2xl border border-brand-navy/[0.08] bg-white shadow-[0_4px_24px_-4px_rgba(0,31,63,0.1)] transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/35 hover:shadow-[0_12px_40px_-8px_rgba(0,31,63,0.18)]";

export function SpecialDealCards({ items }: { items: StorefrontSpecialDeal[] }) {
  if (items.length === 0) {
    return (
      <p className="mx-auto max-w-[40rem] text-center text-[1.2rem] leading-relaxed text-brand-navy/80">
        There are no special offers listed right now. Check back soon, or{" "}
        <Link href="/contact-us" className="font-semibold text-brand-orange underline-offset-2 hover:underline">
          contact us
        </Link>{" "}
        for current promotions.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((deal) => {
        const productHref = deal.productSlug ? `/products/${encodeURIComponent(deal.productSlug)}` : null;
        const body = (
          <>
            {deal.imageUrl ? (
              <div className="relative aspect-[4/3] w-full bg-brand-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={deal.imageUrl}
                  alt={deal.title}
                  className="h-full w-full object-contain p-3"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : (
              <div
                className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-brand-surface to-brand-navy/5 px-4 text-center"
                aria-hidden
              >
                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-navy/40">
                  Special deal
                </span>
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
              {deal.subtitle ? (
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-orange">{deal.subtitle}</p>
              ) : null}
              <h2 className="text-xl font-semibold leading-snug text-brand-navy">{deal.title}</h2>
              {deal.description ? (
                <p className="text-sm leading-relaxed text-brand-navy/80 [overflow-wrap:anywhere]">{deal.description}</p>
              ) : null}
              <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-2">
                {deal.priceLabel ? (
                  <p className="text-lg font-semibold text-brand-navy">{deal.priceLabel}</p>
                ) : (
                  <span />
                )}
                {deal.quantity != null ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-navy/55">
                    Qty available: {deal.quantity}
                  </p>
                ) : null}
              </div>
              {productHref ? (
                <p className="text-sm font-semibold text-brand-orange">View product →</p>
              ) : null}
            </div>
          </>
        );

        return (
          <li key={deal.id}>
            {productHref ? (
              <Link href={productHref} className={cardClass}>
                {body}
              </Link>
            ) : (
              <article className={cardClass}>{body}</article>
            )}
          </li>
        );
      })}
    </ul>
  );
}

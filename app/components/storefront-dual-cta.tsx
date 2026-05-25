import Link from "next/link";

type StorefrontDualCtaProps = {
  /** Hero overlay (white on dark) vs category bar (orange/navy on light). */
  variant: "hero" | "category";
  shopHref?: string;
  quoteHref?: string;
};

const shopHeroClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-orange px-6 py-2.5 text-center text-sm font-bold uppercase tracking-[0.08em] text-white shadow-md transition hover:bg-white hover:text-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-[48px] sm:px-8 sm:text-base";

const quoteHeroClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-full border-2 border-white/90 bg-white/10 px-6 py-2.5 text-center text-sm font-bold uppercase tracking-[0.08em] text-white backdrop-blur-sm transition hover:bg-white hover:text-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-[48px] sm:px-8 sm:text-base";

const shopCategoryClass =
  "inline-flex min-h-[34px] min-w-[12rem] items-center justify-center rounded-full bg-brand-navy px-7 py-2 text-center text-[1.05rem] font-bold uppercase leading-tight tracking-[0.08em] text-white shadow-sm transition hover:bg-brand-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

const quoteCategoryClass =
  "inline-flex min-h-[34px] min-w-[12rem] items-center justify-center rounded-full bg-brand-orange px-7 py-2 text-center text-[1.05rem] font-bold uppercase leading-tight tracking-[0.08em] text-white shadow-sm transition hover:bg-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange";

/** Shop (retail) primary + team bulk quote secondary — dual funnel for 5–20 vs 20+ orders. */
export function StorefrontDualCta({
  variant,
  shopHref = "#shop-categories",
  quoteHref = "/quote",
}: StorefrontDualCtaProps) {
  const isHero = variant === "hero";

  return (
    <div
      className={
        isHero
          ? "flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4"
          : "flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4"
      }
    >
      <Link href={shopHref} className={isHero ? shopHeroClass : shopCategoryClass} data-cyber-guide="cta-shop">
        Shop workwear
      </Link>
      <Link
        href={quoteHref}
        className={isHero ? quoteHeroClass : quoteCategoryClass}
        data-cyber-guide="cat-quote"
      >
        Team quote (20+)
      </Link>
    </div>
  );
}

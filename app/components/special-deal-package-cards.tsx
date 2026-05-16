import Image from "next/image";
import Link from "next/link";

import {
  STOREFRONT_SPECIAL_DEAL_PACKAGES,
  specialDealPackageProductHref,
  type StorefrontSpecialDealPackage,
} from "@/lib/storefront-special-deal-packages";

const cardClass =
  "group flex min-h-[14rem] w-full overflow-hidden rounded-2xl border border-brand-navy/[0.08] bg-white shadow-[0_4px_24px_-4px_rgba(0,31,63,0.12)] transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/35 hover:shadow-[0_12px_40px_-8px_rgba(0,31,63,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange sm:min-h-[16rem]";

function PackageDealCard({ pkg }: { pkg: StorefrontSpecialDealPackage }) {
  const href = specialDealPackageProductHref(pkg);

  return (
    <li className="w-full">
      <Link href={href} className={cardClass}>
        <div className="flex min-h-[14rem] w-full flex-col sm:min-h-[16rem] sm:flex-row">
          <div className="relative flex w-full shrink-0 items-center justify-center bg-brand-surface p-4 sm:w-[44%] sm:max-w-[24rem] sm:min-h-[14rem] sm:self-stretch sm:p-5">
            <Image
              src={pkg.imageSrc}
              alt=""
              width={480}
              height={480}
              className="h-auto max-h-[11rem] w-full max-w-full object-contain object-center transition duration-500 group-hover:scale-[1.02] sm:max-h-[14rem]"
              sizes="(max-width: 640px) 100vw, 24rem"
            />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-3 p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-orange">{pkg.badge}</p>
            <h2 className="text-xl font-semibold leading-snug text-brand-navy sm:text-2xl">{pkg.title}</h2>
            <p className="text-[1.05rem] leading-relaxed text-brand-navy/80 sm:text-[1.1rem]">{pkg.description}</p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3 pt-1">
              <p className="text-[1.75rem] font-semibold tabular-nums text-brand-navy sm:text-[2rem]">
                {pkg.priceLabel}
              </p>
              <span className="text-sm font-semibold text-brand-orange transition group-hover:underline">
                Configure &amp; order →
              </span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

export function SpecialDealPackageCards() {
  return (
    <ul className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6">
      {STOREFRONT_SPECIAL_DEAL_PACKAGES.map((pkg) => (
        <PackageDealCard key={pkg.id} pkg={pkg} />
      ))}
    </ul>
  );
}

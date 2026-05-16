import type { Metadata } from "next";
import { Boldonse } from "next/font/google";

import { SpecialDealCards } from "@/app/components/special-deal-cards";
import { SpecialDealPackageCards } from "@/app/components/special-deal-package-cards";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";
import { listPublishedSpecialDeals } from "@/lib/storefront-special-deals";

const boldonse = Boldonse({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
});

/** DB-backed deals list; align with storefront product cache. */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Special Deals",
  description:
    "Limited-time offers, clearance lines, and special pricing on workwear and uniforms at Boss Workwear.",
  alternates: { canonical: "/special-deals" },
};

export default async function SpecialDealsPage() {
  const { items, loadError } = await listPublishedSpecialDeals();

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <section className={`${SITE_PAGE_ROW_CLASS} pb-14 pt-0`}>
          <header className="mb-10 mt-10 space-y-4 text-center">
            <p
              className={`${boldonse.className} text-[1.35rem] font-normal uppercase tracking-[0.18em] text-brand-orange sm:text-[1.5rem]`}
            >
              Limited time
            </p>
            <h1
              className={`${boldonse.className} text-[clamp(2.25rem,6vw,3.75rem)] font-normal leading-[1.08] tracking-tight text-brand-navy`}
            >
              Special Deals
            </h1>
            <p className="mx-auto max-w-[46.8rem] text-[1.3125rem] leading-relaxed text-brand-navy/85 sm:text-[1.35rem] sm:leading-[2.2rem]">
              Save on selected workwear, uniforms, and clearance lines while stock lasts. Prices and availability are
              updated from our in-store promotions.
            </p>
          </header>

          <div className="space-y-12">
            <section className="space-y-5">
              <h2 className="text-center text-xl font-semibold text-brand-navy sm:text-2xl">Package deals</h2>
              <SpecialDealPackageCards />
            </section>

            {loadError ? (
              <p className="mx-auto max-w-[40rem] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
                We could not load more offers right now. Package deals above are still available, or{" "}
                <a href="/contact-us" className="font-semibold underline">
                  contact us
                </a>
                .
              </p>
            ) : items.length > 0 ? (
              <section className="space-y-5">
                <h2 className="text-center text-xl font-semibold text-brand-navy sm:text-2xl">More offers</h2>
                <SpecialDealCards items={items} />
              </section>
            ) : null}
          </div>
        </section>
      </MainWithSupplierRail>
    </main>
  );
}

import Image from "next/image";
import { Boldonse } from "next/font/google";

import { EmbroideryPriceCalculator } from "@/app/components/embroidery-price-calculator";
import { PrintingPriceCalculator } from "@/app/components/printing-price-calculator";
import { NeedleIcon, PlacementIcon, PrinterIcon } from "@/app/components/icons";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

const boldonse = Boldonse({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const dynamic = "force-dynamic";

export default function ServicePage() {
  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <section className={`${SITE_PAGE_ROW_CLASS} pb-10 pt-0`}>
          <header className="relative left-1/2 z-0 mb-10 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden shadow-[0_8px_40px_-12px_rgba(0,31,63,0.25)]">
            <div className="relative aspect-[16/9] min-h-[12.5rem] w-full sm:min-h-[17.5rem] sm:max-h-[min(58vh,36rem)]">
              <Image
                src="/service_main.png"
                alt="In-store service at Boss Workwear — bring your garments for embroidery and printing."
                fill
                priority
                className="object-cover object-center"
                sizes="100vw"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-brand-navy/80 via-brand-navy/35 to-brand-navy/15"
                aria-hidden
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16">
                <h1
                  className={`${boldonse.className} flex flex-col items-center gap-2 text-[clamp(1.96875rem,calc(7.875vw_+_1.2375rem),10.4175rem)] font-normal leading-[1.08] text-white drop-shadow-[0_2px_24px_rgba(0,31,63,0.45)] sm:gap-3`}
                >
                  <span className="whitespace-nowrap">In store</span>
                  <span className="whitespace-nowrap">Service</span>
                </h1>
              </div>
            </div>
          </header>

          <div className="mx-auto mb-10 max-w-[46.8rem] text-center">
            <p className="text-[1.404rem] leading-[2.455rem] text-brand-navy/90 sm:text-[1.577rem] sm:leading-[2.635rem]">
              Bring your own workwear or garments to our store for on-site embroidery and printing. We apply
              logos, names, and artwork while you shop or wait—ideal when you already have the pieces you want
              decorated.
            </p>
          </div>

          <section
            className="relative mb-12 overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-gradient-to-b from-white via-brand-surface/40 to-brand-surface/70 px-5 py-10 shadow-[0_20px_50px_-12px_rgba(0,31,63,0.12)] sm:px-8 sm:py-12"
            aria-labelledby="service-offer-heading"
          >
            <div
              className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-brand-orange/12 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-brand-navy/[0.06] blur-2xl"
              aria-hidden
            />

            <div className="relative mx-auto max-w-3xl text-center">
              <p
                className={`${boldonse.className} text-[1.575rem] font-normal uppercase tracking-[0.2em] text-brand-orange sm:text-[1.6875rem]`}
              >
                On site
              </p>
              <h2
                id="service-offer-heading"
                className={`${boldonse.className} mt-2 text-[3.375rem] font-normal leading-[1.08] tracking-tight text-brand-navy sm:text-[3.9375rem]`}
              >
                What we offer
              </h2>
            </div>

            <ul className="relative mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <li>
                <article className="group flex h-full flex-col rounded-2xl border border-brand-navy/[0.08] bg-white/90 p-6 shadow-[0_4px_24px_-4px_rgba(0,31,63,0.1)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/35 hover:shadow-[0_12px_40px_-8px_rgba(0,31,63,0.18)]">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 text-brand-navy ring-1 ring-brand-orange/20 transition duration-300 group-hover:from-brand-orange group-hover:to-brand-orange group-hover:text-white group-hover:ring-brand-orange">
                    <NeedleIcon className="h-7 w-7" strokeWidth={1.6} />
                  </div>
                  <h3 className="text-[1.6875rem] font-semibold text-brand-navy">BYO embroidery</h3>
                  <p className="mt-2 flex-1 text-[1.3125rem] leading-relaxed text-brand-navy/75">
                    Logos, names, and artwork stitched on workwear or garments you supply—thread colours and
                    density matched to your brief.
                  </p>
                </article>
              </li>
              <li>
                <article className="group flex h-full flex-col rounded-2xl border border-brand-navy/[0.08] bg-white/90 p-6 shadow-[0_4px_24px_-4px_rgba(0,31,63,0.1)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/35 hover:shadow-[0_12px_40px_-8px_rgba(0,31,63,0.18)]">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 text-brand-navy ring-1 ring-brand-orange/20 transition duration-300 group-hover:from-brand-orange group-hover:to-brand-orange group-hover:text-white group-hover:ring-brand-orange">
                    <PrinterIcon className="h-7 w-7" strokeWidth={1.6} />
                  </div>
                  <h3 className="text-[1.6875rem] font-semibold text-brand-navy">Heat transfer and print</h3>
                  <p className="mt-2 flex-1 text-[1.3125rem] leading-relaxed text-brand-navy/75">
                    DTF and heat-transfer options for crisp graphics on the pieces you bring—great for bold
                    colour and detailed artwork.
                  </p>
                </article>
              </li>
              <li className="sm:col-span-2 lg:col-span-1">
                <article className="group flex h-full flex-col rounded-2xl border border-brand-navy/[0.08] bg-white/90 p-6 shadow-[0_4px_24px_-4px_rgba(0,31,63,0.1)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/35 hover:shadow-[0_12px_40px_-8px_rgba(0,31,63,0.18)]">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 text-brand-navy ring-1 ring-brand-orange/20 transition duration-300 group-hover:from-brand-orange group-hover:to-brand-orange group-hover:text-white group-hover:ring-brand-orange">
                    <PlacementIcon className="h-7 w-7" />
                  </div>
                  <h3 className="text-[1.6875rem] font-semibold text-brand-navy">Placement and materials</h3>
                  <p className="mt-2 flex-1 text-[1.3125rem] leading-relaxed text-brand-navy/75">
                    We help you choose position, size, and the right thread or film for your fabric so the
                    result wears well and looks sharp.
                  </p>
                </article>
              </li>
            </ul>

            <div className="mx-auto mt-10 grid w-full max-w-[min(100%,79.2rem)] gap-0 border-t border-brand-navy/12 pt-8 lg:grid-cols-2 lg:gap-x-10">
              <EmbroideryPriceCalculator embed className="min-w-0 lg:pr-2" />
              <div className="min-w-0 border-t border-brand-navy/12 pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <PrintingPriceCalculator embed className="min-w-0" />
              </div>
            </div>
          </section>

          <section
            className="relative mb-12 overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-gradient-to-b from-white via-brand-surface/40 to-brand-surface/70 px-5 py-10 shadow-[0_20px_50px_-12px_rgba(0,31,63,0.12)] sm:px-8 sm:py-12"
            aria-labelledby="service-steps-heading"
          >
            <div
              className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-brand-orange/12 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 -right-12 h-48 w-48 rounded-full bg-brand-navy/[0.06] blur-2xl"
              aria-hidden
            />

            <div className="relative mx-auto max-w-3xl text-center">
              <p
                className={`${boldonse.className} text-[1.575rem] font-normal uppercase tracking-[0.2em] text-brand-orange sm:text-[1.6875rem]`}
              >
                Your visit
              </p>
              <h2
                id="service-steps-heading"
                className={`${boldonse.className} mt-2 text-[3.375rem] font-normal leading-[1.08] tracking-tight text-brand-navy sm:text-[3.9375rem]`}
              >
                How it works
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[1.26rem] leading-relaxed text-brand-navy/72 sm:text-[1.35rem]">
                Three straightforward steps from the items in your hands to finished decoration—no guesswork.
              </p>
            </div>

            <ol className="relative mx-auto mt-10 grid max-w-5xl list-none gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <li>
                <article className="group flex h-full flex-col rounded-2xl border border-brand-navy/[0.08] bg-white/90 p-6 shadow-[0_4px_24px_-4px_rgba(0,31,63,0.1)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/35 hover:shadow-[0_12px_40px_-8px_rgba(0,31,63,0.18)]">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 text-[1.875rem] font-bold tabular-nums text-brand-navy ring-1 ring-brand-orange/20 transition duration-300 group-hover:from-brand-orange group-hover:to-brand-orange group-hover:text-white group-hover:ring-brand-orange">
                    1
                  </div>
                  <h3 className="text-[1.6875rem] font-semibold text-brand-navy">Bring your items</h3>
                  <p className="mt-2 flex-1 text-[1.3125rem] leading-relaxed text-brand-navy/75">
                    Visit us with clean, garment-ready workwear or pieces you want decorated—we check fabric and
                    suitability on the spot.
                  </p>
                </article>
              </li>
              <li>
                <article className="group flex h-full flex-col rounded-2xl border border-brand-navy/[0.08] bg-white/90 p-6 shadow-[0_4px_24px_-4px_rgba(0,31,63,0.1)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/35 hover:shadow-[0_12px_40px_-8px_rgba(0,31,63,0.18)]">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 text-[1.875rem] font-bold tabular-nums text-brand-navy ring-1 ring-brand-orange/20 transition duration-300 group-hover:from-brand-orange group-hover:to-brand-orange group-hover:text-white group-hover:ring-brand-orange">
                    2
                  </div>
                  <h3 className="text-[1.6875rem] font-semibold text-brand-navy">Tell us the brief</h3>
                  <p className="mt-2 flex-1 text-[1.3125rem] leading-relaxed text-brand-navy/75">
                    Share what you need stitched or printed, preferred placement, colours, and any logo files or
                    reference images you have.
                  </p>
                </article>
              </li>
              <li className="sm:col-span-2 lg:col-span-1">
                <article className="group flex h-full flex-col rounded-2xl border border-brand-navy/[0.08] bg-white/90 p-6 shadow-[0_4px_24px_-4px_rgba(0,31,63,0.1)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/35 hover:shadow-[0_12px_40px_-8px_rgba(0,31,63,0.18)]">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 text-[1.875rem] font-bold tabular-nums text-brand-navy ring-1 ring-brand-orange/20 transition duration-300 group-hover:from-brand-orange group-hover:to-brand-orange group-hover:text-white group-hover:ring-brand-orange">
                    3
                  </div>
                  <h3 className="text-[1.6875rem] font-semibold text-brand-navy">Quote and complete</h3>
                  <p className="mt-2 flex-1 text-[1.3125rem] leading-relaxed text-brand-navy/75">
                    We confirm timing and price, then complete the work on site whenever possible so you leave
                    with pieces ready to wear.
                  </p>
                </article>
              </li>
            </ol>

            <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-brand-navy/10 bg-white px-5 py-5 text-center text-[1.3125rem] leading-relaxed text-brand-navy/75 shadow-[0_4px_24px_-4px_rgba(0,31,63,0.08)]">
              <p>
                For opening hours and location, please{" "}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Shop 152, Coventry Village, shop 42c/253 Walter Rd W, Morley WA 6062")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-navy underline-offset-2 hover:underline"
                  title="Shop 152, Coventry Village, shop 42c/253 Walter Rd W, Morley WA 6062"
                >
                  click for visiting Google map
                </a>
                .
              </p>
            </div>
          </section>

          <section className="mb-12 py-6 sm:py-8" aria-labelledby="express-fee-heading">
            <div className="flex flex-col items-center gap-8 sm:gap-10">
              <div className="min-w-0 w-full text-center">
                <p
                  className={`${boldonse.className} text-[1.575rem] font-normal uppercase tracking-[0.2em] text-brand-orange sm:text-[1.6875rem]`}
                >
                  Rush options
                </p>
                <h2
                  id="express-fee-heading"
                  className={`${boldonse.className} mt-2 text-[3.375rem] font-normal leading-[1.08] tracking-tight text-brand-navy sm:text-[3.9375rem]`}
                >
                  Express fee
                </h2>
                <p className="mx-auto mt-3 max-w-[43.2rem] text-[1.26rem] leading-relaxed text-brand-navy/72 sm:text-[1.35rem]">
                  Need your job finished sooner than our usual turnaround? When we have capacity, we can offer express
                  service. The surcharge is a percentage added to your quoted decoration work (before any taxes)—we will
                  confirm whether express is available and the exact amount when you bring your items in.
                </p>
                <div className="mx-auto mt-5 max-w-[min(100%,86.4rem)] space-y-5 pt-[calc(1.5rem+(1*1.6875rem*1.625))] sm:pt-[calc(1.5rem+(1*1.8rem*1.625))]">
                  <p className="text-[1.6875rem] font-semibold leading-relaxed text-brand-navy sm:text-[1.8rem]">
                    Same day service = 30% Surcharge
                  </p>
                  <p className="text-[1.6875rem] font-semibold leading-relaxed text-brand-navy sm:text-[1.8rem]">
                    Next day service = 15% Surcharge
                  </p>
                  <p className="text-[1.6875rem] font-semibold leading-relaxed text-brand-navy sm:text-[1.8rem]">
                    2~3 Days Service = 10% Surcharge
                  </p>
                </div>
                <p className="mx-auto mt-10 max-w-[min(100%,86.4rem)] text-[1.05rem] leading-relaxed text-brand-navy/75">
                  Standard scheduling applies if you do not request express.
                  <br />
                  Surcharges shown here are a guide only until confirmed in store, and may vary with job size and complexity.
                </p>
              </div>
              <figure className="mx-auto w-full max-w-[min(100%,calc(86.4rem*0.7*0.7))] shrink-0">
                <div className="flex min-h-[4.9rem] items-center justify-center overflow-hidden py-2 sm:min-h-[5.88rem] sm:py-3">
                  <Image
                    src="/Rush_option.png"
                    alt="Rush and express turnaround options."
                    width={1024}
                    height={1024}
                    className="h-auto w-full object-contain object-center"
                    sizes="(max-width: 768px) 100vw, min(100vw, 42.336rem)"
                  />
                </div>
              </figure>
            </div>
          </section>
        </section>
      </MainWithSupplierRail>
    </main>
  );
}

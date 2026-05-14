import { Boldonse } from "next/font/google";

import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";
import { STOREFRONT_QUOTE_EMAIL_RECIPIENT } from "@/lib/storefront-quote-mailto";
import { storeGoogleMapsSearchHref } from "@/lib/store-google-maps-url";

export const dynamic = "force-dynamic";

const boldonse = Boldonse({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const mailtoHref = `mailto:${STOREFRONT_QUOTE_EMAIL_RECIPIENT}`;

const contactCardClass =
  "group flex h-full flex-col rounded-2xl border border-brand-navy/[0.08] bg-white/90 p-6 shadow-[0_4px_24px_-4px_rgba(0,31,63,0.1)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/35 hover:shadow-[0_12px_40px_-8px_rgba(0,31,63,0.18)]";

export default function ContactUsPage() {
  const mapsHref = storeGoogleMapsSearchHref();

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <section className={`${SITE_PAGE_ROW_CLASS} pb-12 pt-0`}>
          <header className="mb-10 mt-10 space-y-4 text-center">
            <p
              className={`${boldonse.className} text-[1.35rem] font-normal uppercase tracking-[0.18em] text-brand-orange sm:text-[1.5rem]`}
            >
              Contact
            </p>
            <h1
              className={`${boldonse.className} text-[clamp(2.25rem,6vw,3.75rem)] font-normal leading-[1.08] tracking-tight text-brand-navy`}
            >
              Contact us
            </h1>
            <p className="mx-auto max-w-[46.8rem] text-[1.3125rem] leading-relaxed text-brand-navy/85 sm:text-[1.35rem] sm:leading-[2.2rem]">
              Visit our showroom, send us an email, or find us on Google Maps. We&apos;re here to help with workwear,
              uniforms, embroidery, and printing.
            </p>
          </header>

          <div
            className="relative overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-gradient-to-b from-white via-brand-surface/40 to-brand-surface/70 px-5 py-10 shadow-[0_20px_50px_-12px_rgba(0,31,63,0.12)] sm:px-8 sm:py-12"
            aria-label="Contact details"
          >
            <div
              className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-brand-orange/12 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-brand-navy/[0.06] blur-2xl"
              aria-hidden
            />

            <div className="relative mx-auto mb-10 max-w-3xl text-center">
              <p
                className={`${boldonse.className} text-[1.35rem] font-normal uppercase tracking-[0.2em] text-brand-orange sm:text-[1.5rem]`}
              >
                Boss Workwear
              </p>
              <h2
                className={`${boldonse.className} mt-2 text-[2.25rem] font-normal leading-[1.1] tracking-tight text-brand-navy sm:text-[2.75rem]`}
              >
                Store &amp; details
              </h2>
            </div>

            <ul className="relative mx-auto grid max-w-5xl list-none gap-5 sm:grid-cols-2 lg:gap-6">
              <li>
                <article className={contactCardClass}>
                  <h3 className="text-[1.35rem] font-semibold text-brand-navy">Company name</h3>
                  <p className="mt-3 text-[1.2rem] leading-relaxed text-brand-navy/80">Boss Workwear PTY LTD</p>
                  <p className="mt-2 text-[1.15rem] leading-relaxed text-brand-navy/75">ABN 54 132 117 018</p>
                </article>
              </li>
              <li>
                <article className={contactCardClass}>
                  <h3 className="text-[1.35rem] font-semibold text-brand-navy">Address</h3>
                  <address className="mt-3 not-italic text-[1.2rem] leading-relaxed text-brand-navy/80">
                    Shop 152, COVENTRY VILLAGE, 243 Walter Rd W
                    <br />
                    Perth Western Australia 6062
                  </address>
                </article>
              </li>
              <li>
                <article className={contactCardClass}>
                  <h3 className="text-[1.35rem] font-semibold text-brand-navy">Phone</h3>
                  <p className="mt-3 text-[1.2rem] leading-relaxed text-brand-navy/80">
                    For phone enquiries, please email us and we will respond as soon as possible.
                  </p>
                </article>
              </li>
              <li>
                <article className={contactCardClass}>
                  <h3 className="text-[1.35rem] font-semibold text-brand-navy">Email</h3>
                  <p className="mt-3 text-[1.2rem] leading-relaxed">
                    <a
                      href={mailtoHref}
                      className="font-semibold text-brand-orange underline-offset-2 hover:underline"
                    >
                      {STOREFRONT_QUOTE_EMAIL_RECIPIENT}
                    </a>
                  </p>
                </article>
              </li>
              <li className="sm:col-span-2">
                <article className={contactCardClass}>
                  <h3 className="text-[1.35rem] font-semibold text-brand-navy">Business hours</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-[1.2rem] leading-relaxed text-brand-navy/80">
                    <li>
                      <strong className="font-semibold text-brand-navy">Monday to Friday:</strong> 10 am – 5 pm
                    </li>
                    <li>
                      <strong className="font-semibold text-brand-navy">Saturday:</strong> 10 am – 2 pm
                    </li>
                    <li>
                      <strong className="font-semibold text-brand-navy">Sunday and public holidays:</strong> Closed
                    </li>
                  </ul>
                  <p className="mt-4 text-[1.15rem] leading-relaxed text-brand-navy/75">
                    Please refer to{" "}
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand-orange underline-offset-2 hover:underline"
                    >
                      Google Maps
                    </a>{" "}
                    for directions and updates.
                  </p>
                </article>
              </li>
            </ul>
          </div>
        </section>
      </MainWithSupplierRail>
    </main>
  );
}

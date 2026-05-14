"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";
import { siteFacebookUrl, siteInstagramUrl, SITE_STORE_ADDRESS_LINES } from "@/lib/site-footer";

function FacebookMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function InstagramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

const footerLinkClass =
  "text-sm text-brand-navy/95 transition hover:text-brand-navy hover:underline";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="print:hidden">
      <div className={`border-t border-brand-navy/10 bg-white py-5 ${SITE_PAGE_ROW_CLASS}`}>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full border border-brand-navy/20 bg-brand-surface px-4 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-brand-navy">
            ISO Certified
          </span>
          <span className="rounded-full border border-brand-navy/20 bg-brand-surface px-4 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-brand-navy">
            Australia-wide Shipping
          </span>
          <span className="rounded-full border border-brand-navy/20 bg-brand-surface px-4 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-brand-navy">
            Bulk Order Discounts
          </span>
        </div>
      </div>

      <div className="bg-gradient-to-r from-[#ffb366] to-[#ff6600] text-brand-navy">
        <div className={`${SITE_PAGE_ROW_CLASS} py-10 sm:py-12`}>
          <div className="grid grid-cols-1 divide-y divide-brand-navy/15 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            <div className="flex flex-col gap-6 py-10 lg:py-0 lg:pr-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy/75">Payment</p>
              <div className="flex flex-wrap items-center gap-4">
                <Image src="/visa.png" alt="Visa" width={56} height={36} className="h-8 w-auto object-contain" />
                <Image
                  src="/mastercard.png"
                  alt="Mastercard"
                  width={56}
                  height={36}
                  className="h-8 w-auto object-contain"
                />
                <Image src="/eftpos.png" alt="EFTPOS" width={56} height={36} className="h-8 w-auto object-contain" />
              </div>
            </div>

            <div className="flex flex-col gap-4 py-10 lg:px-8 lg:py-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-navy/75">Customer care</p>
              <ul className="space-y-2.5 text-sm leading-snug">
                <li className="flex gap-2">
                  <span className="select-none text-brand-navy/50" aria-hidden>
                    –
                  </span>
                  <Link href="/terms-and-conditions" className={footerLinkClass}>
                    Terms &amp; Conditions
                  </Link>
                </li>
                <li className="flex gap-2">
                  <span className="select-none text-brand-navy/50" aria-hidden>
                    –
                  </span>
                  <Link href="/returns-policy" className={footerLinkClass}>
                    Returns Policy
                  </Link>
                </li>
                <li className="flex gap-2">
                  <span className="select-none text-brand-navy/50" aria-hidden>
                    –
                  </span>
                  <Link href="/privacy-policy" className={footerLinkClass}>
                    Privacy Policy
                  </Link>
                </li>
                <li className="flex gap-2">
                  <span className="select-none text-brand-navy/50" aria-hidden>
                    –
                  </span>
                  <Link href="/shipping-policy" className={footerLinkClass}>
                    Shipping Policy
                  </Link>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-4 py-10 lg:px-8 lg:py-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-navy/75">Visit our store</p>
              <address className="not-italic text-sm leading-relaxed text-brand-navy/90">
                {SITE_STORE_ADDRESS_LINES.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
              <Link
                href="/contact-us"
                className="mt-3 inline-flex w-fit items-center justify-center rounded-full border border-brand-navy bg-brand-navy px-5 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white shadow-sm transition hover:bg-brand-navy/90 hover:shadow"
              >
                Contact Us
              </Link>
            </div>

            <div className="flex flex-col items-start gap-4 py-10 last:pb-0 lg:items-center lg:pl-8 lg:py-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-navy/75 lg:text-center">Stay connected</p>
              <div className="flex items-center gap-5">
                <a
                  href={siteInstagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-brand-navy/35 p-2.5 text-brand-navy transition hover:border-brand-navy hover:bg-brand-navy/10"
                  aria-label="Instagram"
                >
                  <InstagramMark className="h-6 w-6" />
                </a>
                <a
                  href={siteFacebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-brand-navy/35 p-2.5 text-brand-navy transition hover:border-brand-navy hover:bg-brand-navy/10"
                  aria-label="Facebook"
                >
                  <FacebookMark className="h-6 w-6" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

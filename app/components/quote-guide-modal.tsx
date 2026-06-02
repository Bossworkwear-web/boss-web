"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { storefrontBulkOrderMailtoHref } from "@/lib/storefront-quote-mailto";

/** Window event other components dispatch to open the quote guide popup in place. */
export const QUOTE_GUIDE_OPEN_EVENT = "boss-web-open-quote-guide";

/** Open the quote guide popup (no navigation). No-op on the server. */
export function openQuoteGuide() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(QUOTE_GUIDE_OPEN_EVENT));
  }
}

/**
 * Instructional popup explaining how to email a quote from the cart. Opens when the
 * home "Free Quote" button lands here (`?quoteGuide=1`) or on the `openQuoteGuide()` event.
 */
export function QuoteGuideModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("quoteGuide") === "1") {
      setOpen(true);
      // Drop the flag so a refresh / back doesn't reopen the popup.
      params.delete("quoteGuide");
      const query = params.toString();
      const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
      window.history.replaceState(null, "", next);
    }
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(QUOTE_GUIDE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(QUOTE_GUIDE_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-guide-title"
        className="max-h-[88vh] w-full max-w-[50.6rem] overflow-visible rounded-2xl border border-brand-navy/15 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-[0.92rem] font-semibold uppercase tracking-[0.12em] text-brand-orange">Free Quote</p>
          <h2 id="quote-guide-title" className="mt-1 text-[1.84rem] font-semibold leading-tight text-brand-navy">
            How to get a free quote
          </h2>
        </div>

        <ol className="mt-5 space-y-3 text-[1.21rem] leading-relaxed text-brand-navy/85">
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-base font-bold text-white">
              1
            </span>
            <span>Browse categories and add the products, sizes and quantities you need to your cart.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-base font-bold text-white">
              2
            </span>
            <span>
              Open the <span className="font-semibold text-brand-navy">Cart</span> page. Your price, volume discount and
              GST are calculated automatically.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-base font-bold text-white">
              3
            </span>
            <span>
              Under the product list, press{" "}
              <span className="font-semibold text-brand-navy">&ldquo;Send email to you as a Quote&rdquo;</span> (sign in
              first if asked). We&apos;ll email you a copy and save it in{" "}
              <span className="font-semibold text-brand-navy">My account → My Quote</span> so you can order it any time.
            </span>
          </li>
        </ol>

        <div className="relative mt-5 rounded-xl border border-brand-navy/10 bg-brand-surface/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/quote-guide-cart.png"
            alt="Cart page showing the Send email to you as a Quote button below the product list"
            className="block h-auto w-full rounded-xl"
            loading="lazy"
          />
          <svg
            viewBox="0 0 1024 728"
            preserveAspectRatio="none"
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <defs>
              <filter id="quote-guide-chalk">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" />
              </filter>
            </defs>
            <ellipse
              className="quote-guide-chalk-ring"
              cx="171"
              cy="553"
              rx="112"
              ry="36"
              pathLength={100}
              transform="rotate(-5 171 553)"
              fill="none"
              stroke="#f97316"
              strokeWidth={7}
              strokeLinecap="round"
              filter="url(#quote-guide-chalk)"
            />
          </svg>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Cyber_Assistant.svg"
            alt="Virtual store assistant pointing at the quote button"
            className="pointer-events-none absolute bottom-[-2cm] left-[calc(20%-7cm)] z-10 h-[57.6%] w-auto drop-shadow-xl"
            loading="lazy"
          />
        </div>
        <style>{`
          .quote-guide-chalk-ring {
            stroke-dasharray: 100;
            animation: quoteGuideChalkDraw 2.6s ease-in-out infinite;
          }
          @keyframes quoteGuideChalkDraw {
            0% { stroke-dashoffset: 100; opacity: 0.15; }
            12% { opacity: 1; }
            55% { stroke-dashoffset: 0; opacity: 1; }
            80% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .quote-guide-chalk-ring { animation: none; stroke-dashoffset: 0; opacity: 1; }
            .quote-guide-bulk-link { animation: none; opacity: 1; }
          }
          .quote-guide-bulk-link {
            animation: quoteGuideBulkLinkPulse 1.8s ease-in-out infinite;
          }
          @keyframes quoteGuideBulkLinkPulse {
            0%, 100% { opacity: 1; text-shadow: none; }
            50% { opacity: 0.45; text-shadow: 0 0 10px rgba(255, 133, 27, 0.55); }
          }
        `}</style>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-md text-[1.2075rem] leading-snug text-brand-navy/85">
            Want a better deal on bulk orders?{" "}
            <a
              href={storefrontBulkOrderMailtoHref()}
              className="quote-guide-bulk-link font-semibold text-brand-orange underline decoration-brand-orange/60 underline-offset-2 hover:brightness-95"
            >
              Please Click here
            </a>
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:shrink-0">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center rounded-xl border border-brand-navy/25 px-5 py-2.5 text-[1.05rem] font-semibold text-brand-navy transition hover:border-brand-orange hover:text-brand-orange"
          >
            Got it
          </button>
          <Link
            href="/cart"
            className="inline-flex items-center justify-center rounded-xl bg-brand-orange px-5 py-2.5 text-[1.05rem] font-semibold text-white transition hover:brightness-95"
          >
            Go to cart
          </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

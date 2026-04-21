"use client";

import { useState } from "react";

import { ImageUrlLightbox } from "@/app/components/image-url-lightbox";

export type OrderTrackMockupItem = {
  id: string;
  publicUrl: string;
  listDate: string;
  decorateSummary: string;
  memo: string | null;
};

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

export function OrderTrackMockupsGrid({
  orderNumber,
  items,
}: {
  orderNumber: string;
  items: OrderTrackMockupItem[];
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const pdf = isPdfUrl(item.publicUrl);
          return (
            <li
              key={item.id}
              className="overflow-hidden rounded-2xl border border-brand-navy/15 bg-brand-surface/30"
            >
              <p className="border-b border-brand-navy/10 bg-white/80 px-3 py-2 text-[1.3125rem] text-brand-navy/70">
                Perth sheet:{" "}
                <span className="font-mono font-semibold text-brand-navy">{item.listDate}</span>
              </p>
              <p className="border-b border-brand-navy/10 px-3 py-2 text-center text-[1.3125rem] font-semibold text-brand-navy">
                {item.decorateSummary}
              </p>
              {item.memo ? (
                <div className="border-b border-brand-navy/10 bg-white/60 px-3 py-2 text-left">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-brand-navy/50">Memo</p>
                  <p className="mt-1 whitespace-pre-wrap text-[1.125rem] text-brand-navy/85">{item.memo}</p>
                </div>
              ) : null}
              {pdf ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 px-3 sm:h-56">
                  <span className="text-[1.3125rem] font-semibold uppercase tracking-wide text-brand-navy/50">
                    PDF
                  </span>
                  <span className="text-[1.3125rem] font-semibold text-brand-navy">Mock-up document</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="block h-48 w-full cursor-zoom-in bg-white/50 p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-inset sm:h-56"
                  onClick={() => setLightboxSrc(item.publicUrl)}
                  aria-label="View mock-up larger"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.publicUrl}
                    alt={`Mock-up for order ${orderNumber}`}
                    className="pointer-events-none h-full w-full object-contain"
                    loading="lazy"
                  />
                </button>
              )}
              <div className="border-t border-brand-navy/10 px-3 py-3">
                {pdf ? (
                  <a
                    href={item.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[1.3125rem] font-semibold text-brand-orange hover:underline"
                  >
                    Open PDF
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(item.publicUrl)}
                    className="text-[1.3125rem] font-semibold text-brand-orange hover:underline"
                  >
                    View larger
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ImageUrlLightbox
        open={Boolean(lightboxSrc)}
        onClose={() => setLightboxSrc(null)}
        src={lightboxSrc ?? ""}
        alt={`Mock-up for order ${orderNumber}`}
        ariaLabel="Full size mock-up image"
      />
    </>
  );
}

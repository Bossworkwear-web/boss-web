"use client";

import { useState } from "react";

import type { ClickUpSheetImageDto } from "@/app/admin/(panel)/click-up-sheet/actions";
import { ImageUrlLightbox } from "@/app/components/image-url-lightbox";
import { parseMockupDecorateMethodsJson } from "@/lib/click-up-sheet-mockup-methods";

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

export function OrderMockupsImageGrid({
  images,
  order,
}: {
  images: ClickUpSheetImageDto[];
  order: string;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => {
          const pdf = isPdfUrl(img.public_url);
          const decorateLabels = parseMockupDecorateMethodsJson(img.mockup_decorate_methods);
          return (
            <li
              key={img.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                Perth sheet: <span className="font-mono font-semibold text-brand-navy">{img.list_date}</span>
              </p>
              {decorateLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1 border-b border-slate-100 bg-white px-3 py-2">
                  {decorateLabels.map((m) => (
                    <span
                      key={m}
                      className="rounded-md bg-brand-navy/10 px-2 py-0.5 text-[0.65rem] font-semibold text-brand-navy"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              ) : null}
              {img.mockup_memo?.trim() ? (
                <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-left">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Memo</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{img.mockup_memo.trim()}</p>
                </div>
              ) : null}
              {pdf ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2 px-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">PDF</span>
                  <span className="text-sm font-semibold text-brand-navy">Mock-up document</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="block h-56 w-full cursor-zoom-in bg-slate-50 p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-inset"
                  onClick={() => setLightboxSrc(img.public_url)}
                  aria-label="View mock-up larger"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.public_url}
                    alt={`Mock-up for order ${order}`}
                    className="pointer-events-none h-full w-full object-contain"
                    loading="lazy"
                  />
                </button>
              )}
              <div className="border-t border-slate-100 px-3 py-2">
                {pdf ? (
                  <a
                    href={img.public_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-brand-orange hover:underline"
                  >
                    Open PDF
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(img.public_url)}
                    className="text-sm font-semibold text-brand-orange hover:underline"
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
        alt={`Mock-up for order ${order}`}
        ariaLabel="Full size mock-up image"
      />
    </>
  );
}

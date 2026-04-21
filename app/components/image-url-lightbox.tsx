"use client";

import { useEffect } from "react";

/**
 * Same interaction as storefront product hero: overlay + dim backdrop, Escape / backdrop / Close / image tap to dismiss.
 * Does not navigate away or open a new window.
 */
export function ImageUrlLightbox({
  open,
  onClose,
  src,
  alt = "",
  ariaLabel = "Enlarged image",
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  ariaLabel?: string;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !src) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close enlarged image"
        onClick={onClose}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-lg bg-white px-3 py-2 text-[1.08rem] font-semibold text-brand-navy shadow-lg hover:bg-brand-surface sm:right-6 sm:top-6"
      >
        Close
      </button>
      <div className="relative z-10 flex max-h-[50dvh] max-w-[50vw] items-center justify-center overflow-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="block h-auto max-h-[50dvh] w-auto max-w-[50vw] cursor-zoom-out object-contain"
          loading="eager"
          decoding="async"
          onClick={onClose}
        />
      </div>
    </div>
  );
}

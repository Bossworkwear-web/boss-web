/** Category hero promo strip: full viewport width (no `SITE_PAGE_ROW` horizontal inset). */
import Image from "next/image";

export function CategoryTopAdBanner({
  src,
  alt,
  waOwnedMarkSrc = "/WA-Owned_Black.png",
}: {
  src: string;
  alt: string;
  /** Overlay mark on the hero (default: black). */
  waOwnedMarkSrc?: string;
}) {
  return (
    <div className="hidden w-full sm:block sm:pt-5">
      <aside
        className="relative z-0 overflow-hidden border-b border-brand-navy/10 bg-white shadow-sm"
        aria-label="Promotion"
      >
        <Image
          src={src}
          alt={alt}
          width={2100}
          height={900}
          className="block h-auto w-full bg-white object-contain"
          sizes="100vw"
          priority
        />
        <div className="pointer-events-none absolute right-2 top-2 z-10 sm:right-3 sm:top-3 md:right-4 md:top-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed px width; next/image span ignored max-width */}
          <img
            src={waOwnedMarkSrc}
            alt="WA Owned"
            width={77}
            height={31}
            className="category-top-ad-wa-mark block h-auto object-contain object-right"
            decoding="async"
          />
        </div>
      </aside>
    </div>
  );
}

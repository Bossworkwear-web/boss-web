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
    <div className="w-full pt-4 sm:pt-5">
      <aside
        className="relative overflow-hidden border-b border-brand-navy/10 bg-white shadow-sm"
        aria-label="Promotion"
      >
        {/* Natural image height so the WA mark overlays the photo (not letterboxed aspect box). */}
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
          <Image
            src={waOwnedMarkSrc}
            alt="WA Owned"
            width={154}
            height={62}
            className="h-auto w-[3.2rem] object-contain object-right sm:w-[3.84rem] md:w-[4.48rem]"
          />
        </div>
      </aside>
    </div>
  );
}

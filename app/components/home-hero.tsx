import { HomeHeroCarousel } from "@/app/components/home-hero-carousel";
import { StorefrontDualCta } from "@/app/components/storefront-dual-cta";
import { getHomepageHeroContent } from "@/lib/site-content";
import { Boldonse } from "next/font/google";

const boldonse = Boldonse({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
});

/**
 * Home hero: centered slideshow + copy overlaid on top (`public/Hero_1.jpg` … `Hero_3.jpg`).
 */
export async function HomeHero() {
  const { line1, line2, subtext } = await getHomepageHeroContent();

  return (
    <div className="home-hero-strip">
      <div className="home-hero-strip-inner home-hero-strip-overlay">
        <div className="home-hero-strip-media relative z-0 w-full">
          <HomeHeroCarousel />
        </div>
        <div className="home-hero-strip-copy-overlay pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-3 py-20 sm:px-5 sm:py-24 lg:px-6">
          <div className="mx-auto w-[80vw] max-w-[80vw] translate-y-4 text-center text-white sm:w-full sm:max-w-[min(100%,calc(120rem*1.452))] sm:translate-y-[1cm]">
            <h1
              className={`${boldonse.className} mt-4 flex flex-col items-center gap-1 text-center text-[clamp(0.924rem,3.696vw+0.5808rem,4.8896rem)] font-normal leading-[1.08] text-white`}
            >
              <span className="text-balance sm:whitespace-nowrap">{line1}</span>
              <span className="text-balance sm:whitespace-nowrap">{line2}</span>
            </h1>
            <p className="mx-auto mt-[calc((1.25rem+2.4024rem)/4)] max-w-[46.8rem] text-[calc(1.57872rem/2)] leading-[calc(2.76276rem/2)] text-white/95 sm:mt-[calc((1.25rem+2.5744rem)/2)] sm:text-[1.77652rem] sm:leading-[2.96056rem]">
              {subtext}
            </p>
            <div className="pointer-events-auto mx-auto mt-6 max-w-xl space-y-2 sm:mt-8">
              <StorefrontDualCta
                variant="hero"
                shopHref="/categories/workwear"
                quoteHref="/categories/workwear?quoteGuide=1"
              />
              <p className="text-[calc(0.85rem*1.3)] leading-snug text-white/80 sm:text-[calc(0.875rem*1.3)]">
                Small team orders — shop online. Bulk branding for 50+ units — free quote.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { HomeHeroCarousel } from "@/app/components/home-hero-carousel";
import { Boldonse } from "next/font/google";

const boldonse = Boldonse({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/**
 * Home hero: centered slideshow + copy overlaid on top (`public/hero_1.jpg` … `hero_3.jpg`).
 */
export function HomeHero() {
  return (
    <div className="home-hero-strip">
      <div className="home-hero-strip-inner home-hero-strip-overlay">
        <div className="home-hero-strip-media relative z-0 w-full">
          <HomeHeroCarousel />
        </div>
        <div className="home-hero-strip-copy-overlay pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-3 py-20 sm:px-5 sm:py-24 lg:px-6">
          <div className="w-full max-w-[min(100vw,120rem)] translate-y-[1cm] text-center text-white">
            <h1
              className={`${boldonse.className} mt-5 flex flex-col items-center gap-1 text-center text-[clamp(1.155rem,4.62vw+0.726rem,6.112rem)] font-normal leading-[1.08] text-white`}
            >
              <span className="whitespace-nowrap">Trusted Workwear for Teams</span>
              <span className="whitespace-nowrap">That Keeps Industries Moving.</span>
            </h1>
            <p className="mx-auto mt-[calc(1.25rem+3.003rem)] max-w-[46.8rem] text-[1.716rem] leading-[3.003rem] text-white/95 sm:mt-[calc(1.25rem+3.218rem)] sm:text-[1.931rem] sm:leading-[3.218rem]">
              From corporate polos to medical scrubs, we deliver professional uniforms designed for durability,
              comfort, and branding impact.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

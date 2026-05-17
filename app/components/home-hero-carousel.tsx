"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDE_INTERVAL_MS = 5500;

/** Paths must match `public/` filenames exactly (Linux/Vercel is case-sensitive). */
const HERO_SLIDES = [
  { src: "/Hero_1.jpg", alt: "Workwear and uniforms — slide 1" },
  { src: "/Hero_2.jpg", alt: "Workwear and uniforms — slide 2" },
  { src: "/Hero_3.jpg", alt: "Workwear and uniforms — slide 3" },
] as const;

/**
 * Slideshow: mobile — ~1.01× scale with side crop (`object-cover`); sm+ — fit (`object-contain`).
 * Dots sit above the media stack for clicks (hero overlay uses `pointer-events-none`).
 */
export function HomeHeroCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="home-hero-strip-slideshow relative isolate min-h-[min(56vh,32rem)] w-full max-w-none overflow-hidden bg-white sm:min-h-[min(64vh,44rem)] lg:min-h-[min(72vh,56rem)]"
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero images"
    >
      {HERO_SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className={`absolute inset-0 overflow-hidden transition-opacity duration-700 ease-in-out sm:flex sm:items-center sm:justify-center sm:overflow-visible sm:py-4 ${
            i === index ? "z-[1] opacity-100" : "z-0 opacity-0"
          } pointer-events-none`}
          aria-hidden={i !== index}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            width={1920}
            height={1080}
            priority={i === 0}
            fetchPriority={i === 0 ? "high" : "low"}
            sizes="100vw"
            className="absolute left-1/2 top-1/2 h-full min-h-full w-full min-w-full max-w-none -translate-x-1/2 -translate-y-1/2 scale-[1.008] object-cover object-center sm:static sm:h-auto sm:min-h-0 sm:min-w-0 sm:max-h-[min(78vh,1080px)] sm:w-full sm:translate-x-0 sm:translate-y-0 sm:scale-100 sm:object-contain"
          />
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-4 z-[5] flex justify-center gap-2 sm:bottom-5">
        {HERO_SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Show image ${i + 1} of ${HERO_SLIDES.length}`}
            aria-current={i === index ? "true" : undefined}
            className={`h-2.5 w-2.5 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
              i === index ? "bg-brand-navy" : "bg-brand-navy/35 hover:bg-brand-navy/55"
            }`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}

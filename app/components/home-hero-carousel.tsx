"use client";

import { useEffect, useState } from "react";

const SLIDE_INTERVAL_MS = 5500;

/** Paths must match `public/` filenames exactly (Linux/Vercel is case-sensitive). */
const HERO_SLIDES = [
  { src: "/Hero_1.jpg", alt: "Workwear and uniforms — slide 1" },
  { src: "/Hero_2.jpg", alt: "Workwear and uniforms — slide 2" },
  { src: "/Hero_3.jpg", alt: "Workwear and uniforms — slide 3" },
] as const;

/**
 * Centered slideshow: images at native aspect, capped by viewport (`object-contain`).
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
      className="home-hero-strip-slideshow relative isolate w-full max-w-none overflow-hidden bg-white"
      style={{ minHeight: "min(72vh, 56rem)" }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero images"
    >
      {HERO_SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className={`absolute inset-0 flex items-center justify-center px-0 py-2 transition-opacity duration-700 ease-in-out sm:py-4 ${
            i === index ? "z-[1] opacity-100" : "z-0 opacity-0"
          } pointer-events-none`}
          aria-hidden={i !== index}
        >
          <img
            src={slide.src}
            alt={slide.alt}
            decoding={i === 0 ? "sync" : "async"}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "low"}
            className="h-auto max-h-[min(78vh,1080px)] w-full max-w-none object-contain"
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

import { Boldonse } from "next/font/google";
import type { ReactNode } from "react";

const boldonse = Boldonse({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/**
 * Category browse pages — Boldonse heading at 2× former `text-4xl`, then −20% twice (2.25rem × 2 × 0.8²).
 */
export function CategoryBrowseTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      className={`${boldonse.className} max-w-full text-balance break-words font-normal leading-[1.2] tracking-tight text-[calc(2.25rem*2*0.8*0.8)] text-brand-navy sm:leading-[1.18]`}
    >
      {children}
    </h1>
  );
}

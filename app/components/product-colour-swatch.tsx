"use client";

import {
  productColourLabelToSwatches,
  productColourSwatchIsWhite,
  type ProductColourSwatchContext,
} from "@/lib/product-colour-swatch";

type ProductColourSwatchProps = {
  label: string;
  /** Compact swatches when the colour grid is dense. */
  compact?: boolean;
  className?: string;
  swatchContext?: ProductColourSwatchContext;
};

type SwatchDotSize = "compact" | "default" | "large";

/** Fixed classes so SSR/client bundles always agree (avoids Turbopack HMR stale-chunk mismatches). */
const SWATCH_DOT_CLASS = {
  compact: "h-[18px] w-[18px] shrink-0 rounded-full border-0",
  compactWhite: "h-[18px] w-[18px] shrink-0 rounded-full border border-neutral-300",
  default: "h-[22px] w-[22px] shrink-0 rounded-full border-0",
  defaultWhite: "h-[22px] w-[22px] shrink-0 rounded-full border border-neutral-300",
  large: "h-[44px] w-[44px] shrink-0 rounded-full border-0",
  largeWhite: "h-[44px] w-[44px] shrink-0 rounded-full border border-neutral-300",
} as const;

function swatchDotClass(size: SwatchDotSize, isWhite: boolean): string {
  if (isWhite) {
    if (size === "compact") {
      return SWATCH_DOT_CLASS.compactWhite;
    }
    if (size === "large") {
      return SWATCH_DOT_CLASS.largeWhite;
    }
    return SWATCH_DOT_CLASS.defaultWhite;
  }
  return SWATCH_DOT_CLASS[size];
}

type ProductColourSwatchDotsProps = {
  label: string;
  /** `large` is 2× default (44px) — used on Size & quantity “Editing” row. */
  size?: SwatchDotSize;
  /** @deprecated Prefer `size="compact"`. */
  compact?: boolean;
  className?: string;
  swatchContext?: ProductColourSwatchContext;
};

/** Circular colour dots only (no text label). */
export function ProductColourSwatchDots({
  label,
  size: sizeProp,
  compact = false,
  className = "",
  swatchContext,
}: ProductColourSwatchDotsProps) {
  const size: SwatchDotSize = sizeProp ?? (compact ? "compact" : "default");
  const swatches = productColourLabelToSwatches(label, swatchContext);
  const gapClass = size === "large" ? "gap-1" : "gap-0.5";

  return (
    <span
      className={`inline-flex items-center ${gapClass} ${className}`.trim()}
      role="img"
      aria-label={label}
      title={label}
    >
      {swatches.map((swatch, i) => (
        <span
          key={`${swatch.label}-${i}`}
          className={swatchDotClass(size, productColourSwatchIsWhite(swatch))}
          style={{ backgroundColor: swatch.hex }}
          aria-hidden
        />
      ))}
    </span>
  );
}

/**
 * Circular colour swatches + label (e.g. Grey / Lime with two circles above text).
 */
export function ProductColourSwatch({
  label,
  compact = false,
  className = "",
  swatchContext,
}: ProductColourSwatchProps) {
  return (
    <span className={`flex flex-col items-center gap-1 ${className}`.trim()}>
      <ProductColourSwatchDots label={label} compact={compact} swatchContext={swatchContext} />
      <span className="block w-full text-center leading-snug">{label}</span>
    </span>
  );
}

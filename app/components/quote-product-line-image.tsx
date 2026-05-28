"use client";

import type { QuoteCatalogProduct } from "@/lib/quote-catalog-products";
import { quoteProductImageForColor } from "@/lib/quote-product-image";

type Props = {
  product: QuoteCatalogProduct | null;
  color: string;
  labelId?: string;
};

export function QuoteProductLineImage({ product, color, labelId }: Props) {
  const imageUrl = product && color.trim() ? quoteProductImageForColor(product, color) : null;
  const altText =
    product && color.trim() ? `${product.displayName} — ${color}` : "Product image preview";

  return (
    <div className="grid gap-1">
      <span id={labelId} className="text-center text-sm font-semibold text-brand-navy">
        IMG
      </span>
      <div
        aria-labelledby={labelId}
        className="flex h-[9rem] w-[9rem] shrink-0 items-center justify-center overflow-hidden rounded-md border border-brand-navy/20 bg-brand-surface/30"
      >
        {imageUrl ? (
          <img src={imageUrl} alt={altText} className="h-full w-full object-contain p-1" loading="lazy" />
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-navy/40">IMG</span>
        )}
      </div>
    </div>
  );
}

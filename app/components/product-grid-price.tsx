import { storefrontCardDisplayPrices } from "@/lib/product-price";
import { productCardModelPriceDiscountGroupStyle } from "@/lib/product-card-model-price-layout";

export function ProductGridPriceCells({
  listPrice,
  salePriceRaw,
  discountPercent,
}: {
  listPrice: number;
  salePriceRaw: unknown;
  discountPercent: number;
}) {
  const { strikePrice, displayPrice } = storefrontCardDisplayPrices(listPrice, salePriceRaw, discountPercent);
  if (strikePrice != null) {
    return (
      <span style={productCardModelPriceDiscountGroupStyle}>
        <span className="product-card-grid-price-was font-light text-brand-navy/55 line-through">
          ${strikePrice.toFixed(1)}
        </span>
        <span className="product-card-grid-price-sale font-semibold text-red-600">${displayPrice.toFixed(1)}</span>
      </span>
    );
  }
  return <span className="product-card-grid-price font-light">${displayPrice.toFixed(1)}</span>;
}

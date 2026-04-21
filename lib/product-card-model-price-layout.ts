import type { CSSProperties } from "react";

/** Between product code and price: two spaces, slash, two spaces (use with `whitespace-pre` on the span). */
export const PRODUCT_CARD_CODE_PRICE_SEPARATOR = "  /  ";

/** Centered inline row: code + separator + price */
export const productCardModelPriceRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  rowGap: "0.125rem",
  columnGap: 0,
  textAlign: "center",
};

export const productCardModelPriceDiscountGroupStyle: CSSProperties = {
  display: "inline-flex",
  flexDirection: "row",
  flexWrap: "nowrap",
  alignItems: "center",
  gap: "0.35rem",
};

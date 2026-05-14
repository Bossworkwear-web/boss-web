import type { InternalOrderTemplate } from "./actions";

/** Stable default for walk-in / message orders (no DB template loaded). */
export const EMPTY_INTERNAL_ORDER_TEMPLATE: InternalOrderTemplate = {
  baseOrderNumber: "",
  customerEmail: "",
  customerName: "",
  deliveryAddress: "",
  currency: "AUD",
  carrier: "Australia Post",
  deliveryFeeCents: 0,
  items: [
    {
      productId: "",
      productName: "",
      quantity: 1,
      unitPriceCents: 0,
      lineTotalCents: 0,
      serviceType: null,
      color: null,
      size: null,
      placementsJson: "[]",
      notes: null,
    },
  ],
};

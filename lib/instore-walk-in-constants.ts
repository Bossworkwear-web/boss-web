/** Default fulfilment note for walk-in printing / embroidery jobs. */
export const INSTORE_WALK_IN_PICKUP_ADDRESS =
  "Pick up — Boss Workwear, Shop 152 Coventry Village, 243 Walter Rd W, Morley WA 6062";

export const INSTORE_WALK_IN_SERVICE_TYPES = ["Embroidery", "Printing", "Embroidery & Printing"] as const;

export const INSTORE_WALK_IN_LOCATIONS = [
  "LHC",
  "RHC",
  "Front Middle",
  "Back Middle",
  "Left Sleeve",
  "Right Sleeve",
] as const;

/** Walk-in cash sale discount applied via /instore_order. */
export const INSTORE_WALK_IN_CASH_SALE_DISCOUNT_RATE = 0.15;

/** First-time company logo set-up fee (matches embroidery calculator). */
export const INSTORE_WALK_IN_LOGO_SETUP_FEE_AUD = 66;

export type InstoreWalkInServiceType = (typeof INSTORE_WALK_IN_SERVICE_TYPES)[number];
export type InstoreWalkInLocation = (typeof INSTORE_WALK_IN_LOCATIONS)[number];

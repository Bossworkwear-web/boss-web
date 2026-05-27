/** Default fulfilment note for walk-in printing / embroidery jobs. */
export const INSTORE_WALK_IN_PICKUP_ADDRESS =
  "Pick up — Boss Workwear, Shop 152 Coventry Village, 243 Walter Rd W, Morley WA 6062";

export const INSTORE_WALK_IN_SERVICE_TYPES = ["Embroidery", "Printing", "Embroidery & Printing"] as const;

export type InstoreWalkInServiceType = (typeof INSTORE_WALK_IN_SERVICE_TYPES)[number];

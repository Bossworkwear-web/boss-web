/**
 * In-store embroidery calculator line items. Adjust `defaultUnitPrice` to match your price list (AUD).
 */
export type EmbroideryCalculatorRowId =
  | "name"
  | "company_logo"
  | "towel_rob"
  | "logo_20cm"
  | "logo_25cm";

export type EmbroideryCalculatorRow = {
  id: EmbroideryCalculatorRowId;
  label: string;
  /** Default unit price shown in the calculator (0 until you set real rates). */
  defaultUnitPrice: number;
};

export const EMBROIDERY_CALCULATOR_ROWS: readonly EmbroideryCalculatorRow[] = [
  { id: "name", label: "Name", defaultUnitPrice: 12 },
  { id: "company_logo", label: "Company Logo", defaultUnitPrice: 15 },
  { id: "towel_rob", label: "Towel/Rob", defaultUnitPrice: 30 },
  { id: "logo_20cm", label: "20cm width logo", defaultUnitPrice: 32 },
  { id: "logo_25cm", label: "25cm width Logo", defaultUnitPrice: 38 },
] as const;

/**
 * Line-level quantity discount (applies to unit × qty for that line). Highest tier only.
 */
export function embroideryQtyDiscountRate(qty: number): number {
  if (qty >= 100) {
    return 0.2;
  }
  if (qty >= 50) {
    return 0.15;
  }
  if (qty >= 20) {
    return 0.1;
  }
  if (qty >= 10) {
    return 0.05;
  }
  return 0;
}

export function embroideryLineGross(unit: number, qty: number): number {
  return Math.round(unit * qty * 100) / 100;
}

/** Gross × (1 − discount rate), rounded to cents. */
export function embroideryLineNetAfterDiscount(unit: number, qty: number): number {
  const gross = unit * qty;
  const rate = embroideryQtyDiscountRate(qty);
  return Math.round(gross * (1 - rate) * 100) / 100;
}

/**
 * In-store printing / heat-transfer calculator line items. Prices in AUD.
 */
export type PrintingCalculatorRowId = "company_logo" | "a6" | "a5" | "a4" | "a3";

export type PrintingCalculatorRow = {
  id: PrintingCalculatorRowId;
  label: string;
  defaultUnitPrice: number;
  /** Minimum units per line for this item. */
  minQty: number;
};

export const PRINTING_CALCULATOR_ROWS: readonly PrintingCalculatorRow[] = [
  { id: "company_logo", label: "Company Logo", defaultUnitPrice: 12, minQty: 5 },
  { id: "a6", label: "A6 Size", defaultUnitPrice: 20, minQty: 4 },
  { id: "a5", label: "A5 Size", defaultUnitPrice: 25, minQty: 4 },
  { id: "a4", label: "A4 Size", defaultUnitPrice: 40, minQty: 2 },
  { id: "a3", label: "A3 Size", defaultUnitPrice: 60, minQty: 1 },
] as const;

export function printingMinQtyForId(id: PrintingCalculatorRowId): number {
  return PRINTING_CALCULATOR_ROWS.find((r) => r.id === id)?.minQty ?? 1;
}

/**
 * Line-level quantity discount (highest tier only).
 * Company Logo: 10+ 10%, 20+ 15%, 50+ 20%, 100+ 30%.
 * A6 / A5 / A4 / A3: 2+ 10%, 5+ 25%, 10+ 30%, 20+ 35%, 50+ 40%, 100+ 50%.
 */
export function printingQtyDiscountRate(id: PrintingCalculatorRowId, qty: number): number {
  if (id === "company_logo") {
    if (qty >= 100) {
      return 0.3;
    }
    if (qty >= 50) {
      return 0.2;
    }
    if (qty >= 20) {
      return 0.15;
    }
    if (qty >= 10) {
      return 0.1;
    }
    return 0;
  }

  if (qty >= 100) {
    return 0.5;
  }
  if (qty >= 50) {
    return 0.4;
  }
  if (qty >= 20) {
    return 0.35;
  }
  if (qty >= 10) {
    return 0.3;
  }
  if (qty >= 5) {
    return 0.25;
  }
  if (qty >= 2) {
    return 0.1;
  }
  return 0;
}

export function printingLineGross(unit: number, qty: number): number {
  return Math.round(unit * qty * 100) / 100;
}

export function printingLineNetAfterDiscount(
  unit: number,
  qty: number,
  id: PrintingCalculatorRowId,
): number {
  const gross = unit * qty;
  const rate = printingQtyDiscountRate(id, qty);
  return Math.round(gross * (1 - rate) * 100) / 100;
}

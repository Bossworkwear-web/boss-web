import {
  EMBROIDERY_CALCULATOR_ROWS,
  embroideryLineNetAfterDiscount,
  embroideryQtyDiscountRate,
  type EmbroideryCalculatorRowId,
} from "@/lib/embroidery-calculator-rows";
import {
  PRINTING_CALCULATOR_ROWS,
  printingLineNetAfterDiscount,
  printingMinQtyForId,
  printingQtyDiscountRate,
  type PrintingCalculatorRowId,
} from "@/lib/printing-calculator-rows";

/** Encoded work item on an instore garment line (`emb:` / `prt:` prefix). */
export type InstoreWorkItemKey = `emb:${EmbroideryCalculatorRowId}` | `prt:${PrintingCalculatorRowId}`;

export type InstoreWorkItemOption = {
  value: InstoreWorkItemKey;
  label: string;
  group: "Embroidery" | "Printing";
  defaultUnitPrice: number;
  minQty: number;
};

export function parseInstoreLineQty(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseInstoreLineUnitAud(raw: string): number {
  const unit = Number.parseFloat(raw.replace(/,/g, "").trim());
  return Number.isFinite(unit) && unit >= 0 ? unit : 0;
}

export function isInstoreWorkItemKey(value: string): value is InstoreWorkItemKey {
  return value.startsWith("emb:") || value.startsWith("prt:");
}

export function instoreWorkItemOptionsForService(service: string): InstoreWorkItemOption[] {
  const embroidery: InstoreWorkItemOption[] = EMBROIDERY_CALCULATOR_ROWS.map((row) => ({
    value: `emb:${row.id}`,
    label: row.label,
    group: "Embroidery",
    defaultUnitPrice: row.defaultUnitPrice,
    minQty: 1,
  }));
  const printing: InstoreWorkItemOption[] = PRINTING_CALCULATOR_ROWS.map((row) => ({
    value: `prt:${row.id}`,
    label: row.label,
    group: "Printing",
    defaultUnitPrice: row.defaultUnitPrice,
    minQty: row.minQty,
  }));

  if (service === "Embroidery") {
    return embroidery;
  }
  if (service === "Printing") {
    return printing;
  }
  if (service === "Embroidery & Printing") {
    return [...embroidery, ...printing];
  }
  return [];
}

export function instoreWorkItemLabel(key: InstoreWorkItemKey): string {
  if (key.startsWith("emb:")) {
    const id = key.slice(4) as EmbroideryCalculatorRowId;
    return EMBROIDERY_CALCULATOR_ROWS.find((r) => r.id === id)?.label ?? id;
  }
  const id = key.slice(4) as PrintingCalculatorRowId;
  return PRINTING_CALCULATOR_ROWS.find((r) => r.id === id)?.label ?? id;
}

export function instoreDefaultUnitForWorkItem(key: InstoreWorkItemKey): number {
  if (key.startsWith("emb:")) {
    const id = key.slice(4) as EmbroideryCalculatorRowId;
    return EMBROIDERY_CALCULATOR_ROWS.find((r) => r.id === id)?.defaultUnitPrice ?? 0;
  }
  const id = key.slice(4) as PrintingCalculatorRowId;
  return PRINTING_CALCULATOR_ROWS.find((r) => r.id === id)?.defaultUnitPrice ?? 0;
}

export function instoreMinQtyForWorkItem(key: InstoreWorkItemKey): number {
  if (key.startsWith("emb:")) {
    return 1;
  }
  const id = key.slice(4) as PrintingCalculatorRowId;
  return printingMinQtyForId(id);
}

export function instoreQtyDiscountRate(key: InstoreWorkItemKey, qty: number): number {
  if (key.startsWith("emb:")) {
    return embroideryQtyDiscountRate(qty);
  }
  const id = key.slice(4) as PrintingCalculatorRowId;
  return printingQtyDiscountRate(id, qty);
}

/** Line total after volume discount (same as floating calculators). */
export function instoreLineNetAud(key: InstoreWorkItemKey, unit: number, qty: number): number {
  if (qty <= 0 || unit < 0) {
    return 0;
  }
  if (key.startsWith("emb:")) {
    return embroideryLineNetAfterDiscount(unit, qty);
  }
  const id = key.slice(4) as PrintingCalculatorRowId;
  return printingLineNetAfterDiscount(unit, qty, id);
}

/** Unit price to store so `unit × qty` matches discounted line total on the server. */
export function instoreEffectiveUnitAud(key: InstoreWorkItemKey, unit: number, qty: number): number {
  const net = instoreLineNetAud(key, unit, qty);
  if (qty <= 0) {
    return 0;
  }
  return Math.round((net / qty) * 100) / 100;
}

export function instoreDiscountPercentLabel(rate: number): string | null {
  if (rate <= 0) {
    return null;
  }
  return `${Math.round(rate * 100)}% volume discount`;
}

export function instoreLineSubtotalAud(workItemId: string, unitAud: string, qty: string): number {
  const qtyNum = parseInstoreLineQty(qty);
  const unit = parseInstoreLineUnitAud(unitAud);
  if (qtyNum <= 0) {
    return 0;
  }
  if (isInstoreWorkItemKey(workItemId)) {
    return instoreLineNetAud(workItemId, unit, qtyNum);
  }
  return Math.round(unit * qtyNum * 100) / 100;
}

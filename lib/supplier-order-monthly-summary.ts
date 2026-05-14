export type SupplierOrderLineForReport = {
  supplier: string;
  quantity: number;
  unit_price_cents: number;
};

export type SupplierMonthlySummaryRow = {
  supplier: string;
  totalQty: number;
  totalCents: number;
};

/** Line total = quantity × unit_price_cents; grouped by supplier name. */
export function aggregateSupplierLinesBySupplier(lines: SupplierOrderLineForReport[]): SupplierMonthlySummaryRow[] {
  const map = new Map<string, { totalQty: number; totalCents: number }>();
  for (const r of lines) {
    const supplier = r.supplier?.trim() || "—";
    const qty = Math.max(0, Math.floor(Number(r.quantity) || 0));
    const unit = Math.max(0, Math.floor(Number(r.unit_price_cents) || 0));
    const prev = map.get(supplier) ?? { totalQty: 0, totalCents: 0 };
    map.set(supplier, {
      totalQty: prev.totalQty + qty,
      totalCents: prev.totalCents + qty * unit,
    });
  }
  return [...map.entries()]
    .map(([supplier, v]) => ({ supplier, totalQty: v.totalQty, totalCents: v.totalCents }))
    .sort((a, b) => a.supplier.localeCompare(b.supplier));
}

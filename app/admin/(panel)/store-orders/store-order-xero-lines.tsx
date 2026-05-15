import {
  audExGstFromInclGstCents,
  formatAudExGstFromInclGstCents,
} from "@/lib/store-order-gst";

export type StoreOrderXeroProductLine = {
  productId: string;
  supplierName: string;
  productName: string;
  quantity: number;
  unitPriceCentsInclGst: number;
  lineTotalCentsInclGst: number;
};

/** Combine rows that share the same non-empty product ID (sum qty and line total). */
export function mergeStoreOrderXeroProductLinesByProductId(
  lines: StoreOrderXeroProductLine[],
): StoreOrderXeroProductLine[] {
  const mergedById = new Map<string, StoreOrderXeroProductLine>();
  const withoutProductId: StoreOrderXeroProductLine[] = [];

  for (const line of lines) {
    const productId = line.productId.trim();
    if (!productId) {
      withoutProductId.push(line);
      continue;
    }

    const existing = mergedById.get(productId);
    if (!existing) {
      mergedById.set(productId, { ...line, productId });
      continue;
    }

    const qty = existing.quantity + line.quantity;
    const lineTotal = existing.lineTotalCentsInclGst + line.lineTotalCentsInclGst;
    mergedById.set(productId, {
      productId,
      supplierName: existing.supplierName || line.supplierName,
      productName: existing.productName || line.productName,
      quantity: qty,
      lineTotalCentsInclGst: lineTotal,
      unitPriceCentsInclGst: qty > 0 ? Math.round(lineTotal / qty) : 0,
    });
  }

  return [...mergedById.values(), ...withoutProductId];
}

type Props = {
  customerName: string;
  paymentDateLabel: string;
  currency: string;
  productLines: StoreOrderXeroProductLine[];
  deliveryFeeCentsInclGst: number;
};

function lineLabel(line: StoreOrderXeroProductLine): string {
  return line.productName.trim() || "Product";
}

export function StoreOrderXeroLines({
  customerName,
  paymentDateLabel,
  currency,
  productLines,
  deliveryFeeCentsInclGst,
}: Props) {
  const deliveryCents = Math.max(0, Number(deliveryFeeCentsInclGst) || 0);
  const consolidated = mergeStoreOrderXeroProductLinesByProductId(productLines);
  const rows: { supplier: string; label: string; qty: number; unitCents: number; lineCents: number }[] =
    consolidated.map((line) => ({
      supplier: line.supplierName.trim() || "—",
      label: lineLabel(line),
      qty: Math.max(1, Math.floor(line.quantity) || 1),
      unitCents: line.unitPriceCentsInclGst,
      lineCents: line.lineTotalCentsInclGst,
    }));
  if (deliveryCents > 0) {
    rows.push({
      supplier: "—",
      label: "Delivery",
      qty: 1,
      unitCents: deliveryCents,
      lineCents: deliveryCents,
    });
  }

  if (rows.length === 0) {
    return <p className="text-xs text-slate-500">No paid line items on file.</p>;
  }

  const totalExGst = rows.reduce((sum, r) => sum + audExGstFromInclGstCents(r.lineCents), 0);
  const totalFormatted = totalExGst.toLocaleString("en-AU", {
    style: "currency",
    currency: currency.trim() || "AUD",
  });

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-600">
        <p>
          <span className="font-semibold text-brand-navy">Customer / company:</span> {customerName}
        </p>
        <p>
          <span className="font-semibold text-brand-navy">Payment date:</span> {paymentDateLabel}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[20rem] border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-600">
              <th className="px-2 py-1.5">Supplier</th>
              <th className="px-2 py-1.5">Product</th>
              <th className="px-2 py-1.5 text-right">Qty</th>
              <th className="px-2 py-1.5 text-right">Unit (ex GST)</th>
              <th className="px-2 py-1.5 text-right">Amount (ex GST)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.supplier}-${row.label}-${idx}`} className="border-t border-slate-100">
                <td className="px-2 py-1.5 text-slate-700">{row.supplier}</td>
                <td className="px-2 py-1.5 font-medium text-brand-navy">{row.label}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{row.qty}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatAudExGstFromInclGstCents(row.unitCents, currency)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                  {formatAudExGstFromInclGstCents(row.lineCents, currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-brand-navy">
              <td colSpan={4} className="px-2 py-1.5 text-right">
                Total (ex GST)
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{totalFormatted}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[0.65rem] leading-snug text-slate-500">
        Amounts exclude 10% GST (derived from stored GST-inclusive prices). Use for Xero sales invoices.
      </p>
    </div>
  );
}

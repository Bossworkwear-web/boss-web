"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

type Props = {
  /** Code128 payload (e.g. 32-char hex from `store_orders.order_scan_code`). */
  value: string;
  className?: string;
  /** Narrower bars / shorter height for queue tables. */
  compact?: boolean;
  /** When false, omit the “Order barcode” caption (still has aria-label on svg). */
  showLabel?: boolean;
};

export function StoreOrderBarcode({ value, className, compact = false, showLabel = true }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const v = value.trim();
    if (!svg || !v) return;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    try {
      JsBarcode(
        svg,
        v,
        compact
          ? {
              format: "CODE128",
              displayValue: true,
              lineColor: "#0f172a",
              background: "#ffffff",
              width: 0.9,
              height: 28,
              margin: 2,
              fontSize: 7,
            }
          : {
              format: "CODE128",
              displayValue: true,
              lineColor: "#0f172a",
              background: "#ffffff",
              width: 1.15,
              height: 44,
              margin: 4,
              fontSize: 10,
            },
      );
    } catch {
      /* invalid payload for encoder */
    }
  }, [value, compact]);

  if (!value.trim()) {
    return null;
  }

  return (
    <div className={className ?? ""}>
      {showLabel ? (
        <p className="production-pack-print-barcode-label mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
          Order barcode
        </p>
      ) : null}
      <svg ref={svgRef} className="max-w-full text-brand-navy" aria-label={`Order barcode ${value}`} />
    </div>
  );
}

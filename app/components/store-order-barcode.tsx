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
  /** Double bar height, bar width, and text for labels / print sheets. */
  large?: boolean;
};

export function StoreOrderBarcode({
  value,
  className,
  compact = false,
  showLabel = true,
  large = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const v = value.trim();
    if (!svg || !v) return;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    const m = large ? 2 : 1;
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
              width: 0.9 * m,
              height: 28 * m,
              margin: 2 * m,
              fontSize: 7 * m,
            }
          : {
              format: "CODE128",
              displayValue: true,
              lineColor: "#0f172a",
              background: "#ffffff",
              width: 1.15 * m,
              height: 44 * m,
              margin: 4 * m,
              fontSize: 10 * m,
            },
      );
    } catch {
      /* invalid payload for encoder */
    }
  }, [value, compact, large]);

  if (!value.trim()) {
    return null;
  }

  return (
    <div className={className ?? ""}>
      {showLabel ? (
        <p
          className={`production-pack-print-barcode-label mb-1 font-semibold uppercase tracking-wide text-slate-500 ${large ? "text-[1.3rem]" : "text-[0.65rem]"}`}
        >
          Order barcode
        </p>
      ) : null}
      <svg ref={svgRef} className="max-w-full text-brand-navy" aria-label={`Order barcode ${value}`} />
    </div>
  );
}

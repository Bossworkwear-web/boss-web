"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { StoreOrderBarcode } from "@/app/components/store-order-barcode";

type Props = {
  value: string;
  /** Shown for screen readers (e.g. store order number). */
  orderNumber: string;
};

export function DispatchExpandableBarcode({ value, orderNumber }: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
            role="presentation"
            onClick={close}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Order barcode enlarged, order ${orderNumber}`}
              className="max-h-[min(90vh,42rem)] max-w-[min(96vw,40rem)] cursor-pointer overflow-auto rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl"
              onClick={close}
            >
              <p className="mb-3 text-center text-sm font-semibold text-slate-600">
                닫으려면 팝업 아무 곳이나 누르세요 · Order{" "}
                <span className="font-mono text-brand-navy">{orderNumber}</span>
              </p>
              <StoreOrderBarcode value={value} className="mx-auto max-w-full" />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-zoom-in rounded-md border border-transparent p-0.5 text-left transition hover:border-slate-200 hover:bg-slate-50"
        aria-label={`Enlarge barcode for order ${orderNumber}`}
      >
        <StoreOrderBarcode value={value} compact showLabel={false} className="pointer-events-none max-w-[10.5rem]" />
      </button>
      {modal}
    </>
  );
}

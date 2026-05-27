"use client";

import { useEffect } from "react";

import {
  INSTORE_WALK_IN_CASH_SALE_DISCOUNT_RATE,
  INSTORE_WALK_IN_LOGO_SETUP_FEE_AUD,
  INSTORE_WALK_IN_PICKUP_ADDRESS,
} from "@/lib/instore-walk-in-constants";
import {
  instoreLineSubtotalAud,
  instoreWorkItemLabel,
  isInstoreWorkItemKey,
} from "@/lib/instore-order-line-pricing";
import { stripUploadedAssetUrlsFromCheckoutNotes } from "@/lib/store-order-customer-detail";

export type InstoreOrderPrintLine = {
  description: string;
  service: string;
  workItemId: string;
  imageUrls: string[];
  location: string;
  color: string;
  size: string;
  qty: string;
  unitAud: string;
  notes: string;
};

export type InstoreOrderPrintSnapshot = {
  savedOrderNumber?: string;
  printedAt: string;
  customerName: string;
  customerPhone: string;
  dueDate: string;
  displayTotalAud: number;
  estimatedTotalAud: number;
  totalBeforeCashAud: number;
  cashSale: boolean;
  logoSetup: boolean;
  lines: InstoreOrderPrintLine[];
  pickup: boolean;
  deliveryAddress: string;
  orderNotes: string;
};

function dash(value: string): string {
  const v = value.trim();
  return v || "—";
}

function formatMoneyAud(n: number): string {
  return `$${n.toFixed(2)}`;
}

function lineUnitAud(line: InstoreOrderPrintLine): number {
  const unit = Number.parseFloat(line.unitAud.replace(/,/g, "").trim());
  return Number.isFinite(unit) && unit >= 0 ? unit : 0;
}

function lineQty(line: InstoreOrderPrintLine): number {
  const qty = Number.parseInt(line.qty, 10);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function lineHasContent(line: InstoreOrderPrintLine): boolean {
  return !!(
    line.description.trim() ||
    line.workItemId?.trim() ||
    (line.imageUrls?.length ?? 0) > 0 ||
    line.color.trim() ||
    line.size.trim() ||
    line.notes.trim() ||
    line.location.trim() ||
    lineUnitAud(line) > 0 ||
    lineQty(line) > 1
  );
}

export function printInstoreOrderFromPreview(): void {
  document.body.classList.add("instore-order-print-mode");
  const cleanup = () => {
    document.body.classList.remove("instore-order-print-mode");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

type InstoreOrderPrintPreviewProps = {
  snapshot: InstoreOrderPrintSnapshot;
  onClose: () => void;
};

export function InstoreOrderPrintPreview({ snapshot, onClose }: InstoreOrderPrintPreviewProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const printableLines = snapshot.lines.filter(lineHasContent);

  return (
    <div
      id="instore-order-print-preview-overlay"
      className="fixed inset-0 z-[200] flex flex-col bg-brand-navy/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instore-order-print-preview-title"
    >
      <div className="instore-order-print-preview-chrome flex shrink-0 items-center justify-between gap-3 border-b border-brand-navy/10 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div>
          <h2 id="instore-order-print-preview-title" className="text-base font-semibold text-brand-navy">
            Print preview
          </h2>
          <p className="text-xs text-brand-navy/60">Check the layout, then print or close to return to the form.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-brand-navy/20 bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-surface/80"
          >
            Close
          </button>
          <button
            type="button"
            onClick={printInstoreOrderFromPreview}
            className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-95"
          >
            Print
          </button>
        </div>
      </div>

      <div className="instore-order-print-preview-scroll flex-1 overflow-auto p-4 sm:p-6">
        <article
          id="instore-order-print-preview-sheet"
          className="mx-auto max-w-[67.2rem] rounded-lg border border-brand-navy/15 bg-white p-6 shadow-xl sm:p-8"
        >
          <header className="border-b border-brand-navy/15 pb-4 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-brand-navy">Instore order</h1>
            {snapshot.savedOrderNumber ? (
              <p className="mt-1 font-mono text-sm font-semibold text-brand-navy">{snapshot.savedOrderNumber}</p>
            ) : null}
            <p className="mt-1 text-xs text-brand-navy/65">{snapshot.printedAt}</p>
          </header>

          <section className="mt-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy">Customer</h2>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-brand-navy/55">Name</dt>
                <dd className="text-brand-navy">{dash(snapshot.customerName)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-brand-navy/55">Phone</dt>
                <dd className="text-brand-navy">{dash(snapshot.customerPhone)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-brand-navy/55">Due date</dt>
                <dd className="text-brand-navy">{dash(snapshot.dueDate)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold text-brand-navy/55">Total amount</dt>
                <dd className="tabular-nums text-brand-navy">
                  {snapshot.cashSale && snapshot.estimatedTotalAud > 0 ? (
                    <span className="mr-2 text-brand-navy/45 line-through">
                      {formatMoneyAud(snapshot.totalBeforeCashAud)}
                    </span>
                  ) : null}
                  <span className="font-semibold">{formatMoneyAud(snapshot.displayTotalAud)} AUD</span>
                  {snapshot.logoSetup ? (
                    <span className="mt-1 block text-xs text-brand-navy/70">
                      Includes logo set-up {formatMoneyAud(INSTORE_WALK_IN_LOGO_SETUP_FEE_AUD)}
                    </span>
                  ) : null}
                  {snapshot.cashSale ? (
                    <span className="ml-2 text-xs font-semibold text-brand-orange">
                      ({Math.round(INSTORE_WALK_IN_CASH_SALE_DISCOUNT_RATE * 100)}% cash sale)
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy">Garments &amp; services</h2>
            {printableLines.length === 0 ? (
              <p className="mt-2 text-sm text-brand-navy/55">No line items entered yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-brand-navy/20 text-left text-xs font-semibold uppercase tracking-wide text-brand-navy/70">
                      <th className="py-2 pr-2">#</th>
                      <th className="py-2 pr-2">Description</th>
                      <th className="py-2 pr-2">Service</th>
                      <th className="py-2 pr-2">Location</th>
                      <th className="py-2 pr-2">Colour</th>
                      <th className="py-2 pr-2">Size</th>
                      <th className="py-2 pr-2 text-right">Qty</th>
                      <th className="py-2 pr-2 text-right">Each</th>
                      <th className="py-2 text-right">Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printableLines.map((line, index) => {
                      const qty = lineQty(line) || 1;
                      const unit = lineUnitAud(line);
                      const lineTotal = instoreLineSubtotalAud(line.workItemId ?? "", line.unitAud, line.qty);
                      const workItemId = line.workItemId ?? "";
                      const workLabel = isInstoreWorkItemKey(workItemId)
                        ? instoreWorkItemLabel(workItemId)
                        : "";
                      return (
                        <tr key={index} className="border-b border-brand-navy/10 align-top">
                          <td className="py-2 pr-2 tabular-nums text-brand-navy/70">{index + 1}</td>
                          <td className="py-2 pr-2 text-brand-navy">{dash(line.description)}</td>
                          <td className="py-2 pr-2 text-brand-navy">
                            {dash(line.service)}
                            {workLabel ? (
                              <span className="mt-0.5 block text-xs text-brand-navy/65">{workLabel}</span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-2 text-brand-navy">{dash(line.location)}</td>
                          <td className="py-2 pr-2 text-brand-navy">{dash(line.color)}</td>
                          <td className="py-2 pr-2 text-brand-navy">{dash(line.size)}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-brand-navy">{qty}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-brand-navy">
                            {unit > 0 ? formatMoneyAud(unit) : "—"}
                          </td>
                          <td className="py-2 text-right tabular-nums font-medium text-brand-navy">
                            {lineTotal > 0 ? formatMoneyAud(lineTotal) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {printableLines.some((l) => l.notes.trim() || (l.imageUrls?.length ?? 0) > 0) ? (
              <ul className="mt-3 space-y-3 text-xs text-brand-navy/80">
                {printableLines.map((line, index) => {
                  const noteText = stripUploadedAssetUrlsFromCheckoutNotes(line.notes.trim());
                  const images = line.imageUrls ?? [];
                  if (!noteText && images.length === 0) {
                    return null;
                  }
                  return (
                    <li key={index}>
                      {noteText ? (
                        <p>
                          <span className="font-semibold">Item {index + 1} notes:</span> {noteText}
                        </p>
                      ) : null}
                      {images.length > 0 ? (
                        <ul className={`grid grid-cols-3 gap-2 sm:grid-cols-4 ${noteText ? "mt-2" : ""}`}>
                          {images.map((url) => (
                            <li key={url} className="overflow-hidden rounded border border-brand-navy/15 bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="aspect-square w-full object-contain p-1" />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy">Collection</h2>
            <p className="mt-2 text-sm text-brand-navy">
              {snapshot.pickup ? (
                <>
                  <span className="font-semibold">Pick up in store</span>
                  <span className="mt-1 block text-brand-navy/75">{INSTORE_WALK_IN_PICKUP_ADDRESS}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">Deliver / ship later</span>
                  {snapshot.deliveryAddress.trim() ? (
                    <span className="mt-1 block whitespace-pre-wrap text-brand-navy/75">
                      {snapshot.deliveryAddress.trim()}
                    </span>
                  ) : null}
                </>
              )}
            </p>
            {snapshot.orderNotes.trim() ? (
              <p className="mt-3 text-sm text-brand-navy">
                <span className="font-semibold">Order notes:</span> {snapshot.orderNotes.trim()}
              </p>
            ) : null}
          </section>
        </article>
      </div>
    </div>
  );
}

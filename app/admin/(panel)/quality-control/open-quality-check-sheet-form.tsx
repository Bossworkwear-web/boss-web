"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StoreOrderBarcode } from "@/app/components/store-order-barcode";

import { getStoreOrderScanCodeByOrderNumber } from "./actions";

export function OpenQualityCheckSheetForm() {
  const router = useRouter();
  const [listDate, setListDate] = useState("");
  const [customerOrderId, setCustomerOrderId] = useState("");
  const [orderScanPreview, setOrderScanPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const oid = customerOrderId.trim();
    const delayMs = oid ? 400 : 0;
    const t = window.setTimeout(() => {
      void (async () => {
        if (!oid) {
          if (!cancelled) setOrderScanPreview(null);
          return;
        }
        const scan = await getStoreOrderScanCodeByOrderNumber(oid);
        if (!cancelled) setOrderScanPreview(scan);
      })();
    }, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [customerOrderId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ld = listDate.trim();
    const oid = customerOrderId.trim();
    const q = new URLSearchParams();
    if (ld) {
      q.set("list_date", ld);
    }
    if (oid) {
      q.set("customer_order_id", oid);
    }
    const suffix = q.toString();
    router.push(suffix ? `/admin/quality-check-sheet?${suffix}` : "/admin/quality-check-sheet");
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="qc-list-date" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            List date (Perth worksheet)
          </label>
          <input
            id="qc-list-date"
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={listDate}
            onChange={(e) => setListDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="qc-order-id" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Customer order ID
          </label>
          <input
            id="qc-order-id"
            type="text"
            placeholder="Store order number / ID"
            value={customerOrderId}
            onChange={(e) => setCustomerOrderId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
            autoComplete="off"
          />
        </div>
      </div>
      {orderScanPreview ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
          <StoreOrderBarcode value={orderScanPreview} compact className="max-w-[min(100%,18rem)]" />
        </div>
      ) : null}
      <button
        type="submit"
        className="rounded-xl bg-brand-orange px-5 py-2.5 text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95"
      >
        Open Quality Check sheet →
      </button>
      <p className="text-xs text-slate-500">
        날짜·주문 ID를 비우면 빈 시트로 열립니다. Click Up 행의 “Quality” 링크와 동일한 주소로 이동합니다.
      </p>
    </form>
  );
}

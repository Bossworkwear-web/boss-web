"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { StoreOrderBarcode } from "@/app/components/store-order-barcode";

import type { StoreOrderCustomerMemoLine } from "@/lib/store-order-customer-detail";
import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { notifyRouteLoadingStart, stopRouteLoading } from "@/lib/route-loading";
import { supplierOrderProductIdHeadTail } from "@/lib/supplier-order-product-id-parts";
import { normalizeSupplierOrderLineSupplierValue } from "@/lib/supplier-order-supplier-normalize";

import {
  loadSupplierOrderLinesForClickUpSheet,
  lookupCustomerByStoreOrderNumber,
  moveClickUpSheetOrderToProduction,
  storeOrderProductionQueueStatus,
  type ClickUpSheetImageDto,
  type ClickUpSupplierLineRow,
  type CustomerReferenceVisualDto,
} from "./actions";
import { ClickUpSheetCustomerReferenceSection } from "./click-up-sheet-customer-reference-section";
import { ClickUpSheetImagesSection } from "./click-up-sheet-images-section";
import { ClickUpSheetLogoFileLinksSection } from "./click-up-sheet-logo-file-links-section";

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

const CLICK_UP_SHEET_DRAFT_PREFIX = "bossww:click-up-sheet-draft:v1";

function clickUpDraftStorageKey(listDateYmd: string, customerOrderId: string): string {
  const ld = listDateYmd.trim();
  const oid = customerOrderId.trim() || "_";
  return `${CLICK_UP_SHEET_DRAFT_PREFIX}:${ld}:${oid}`;
}

type ClickUpSheetDraftV1 = {
  v: 1;
  orderId: string;
  organisationName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  logoLocations: string;
  savedAt: string;
};

function parseClickUpDraft(raw: string): ClickUpSheetDraftV1 | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const d = o as Partial<ClickUpSheetDraftV1>;
    if (d.v !== 1) return null;
    return {
      v: 1,
      orderId: typeof d.orderId === "string" ? d.orderId : "",
      organisationName: typeof d.organisationName === "string" ? d.organisationName : "",
      customerName: typeof d.customerName === "string" ? d.customerName : "",
      customerEmail: typeof d.customerEmail === "string" ? d.customerEmail : "",
      customerPhone: typeof d.customerPhone === "string" ? d.customerPhone : "",
      logoLocations: typeof d.logoLocations === "string" ? d.logoLocations : "",
      savedAt: typeof d.savedAt === "string" ? d.savedAt : "",
    };
  } catch {
    return null;
  }
}

function lineTotalCents(row: Pick<ClickUpSupplierLineRow, "quantity" | "unit_price_cents">) {
  return Math.max(0, row.quantity) * Math.max(0, row.unit_price_cents);
}

function ProductIdReadonly({ raw }: { raw: string }) {
  const trimmed = (raw ?? "").trim();
  const pt = supplierOrderProductIdHeadTail(raw ?? "");
  if (!trimmed) {
    return <span className="text-slate-400">—</span>;
  }
  if (!pt) {
    return <span className="font-mono uppercase">{raw}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-0 break-all font-mono uppercase">
      <span className="text-slate-500/60">
        {pt.head}
        <span aria-hidden="true">-</span>
      </span>
      <span className="text-[1.05em] font-bold text-slate-900">{pt.tail}</span>
    </span>
  );
}

type Props = {
  initialListDate: string;
  initialCustomerOrderId: string;
  initialOrganisationName: string;
  initialCustomerName: string;
  initialCustomerEmail: string;
  initialCustomerPhone: string;
  initialFulfillmentMethod?: "Pickup" | "Delivery";
  initialDeliveryAddress?: string;
  initialDeliveryFeeCents?: number;
  initialLogoLocations: string;
  initialCheckoutMemos: StoreOrderCustomerMemoLine[];
  initialSupplierLines: ClickUpSupplierLineRow[];
  initialMockupImages: ClickUpSheetImageDto[];
  initialReferenceImages: ClickUpSheetImageDto[];
  initialCustomerReferenceItems: CustomerReferenceVisualDto[];
  /** Code128 payload for the resolved store order (same as Production / QC / Dispatch). */
  initialOrderScanPayload?: string | null;
  /** Opened from Completed Order → Pre-process documents: view-only UI (mutations also blocked server-side). */
  completeOrdersDocumentsView?: boolean;
};

export function ClickUpSheetWorkspace({
  initialListDate,
  initialCustomerOrderId,
  initialOrganisationName,
  initialCustomerName,
  initialCustomerEmail,
  initialCustomerPhone,
  initialFulfillmentMethod = "Delivery",
  initialDeliveryAddress = "",
  initialDeliveryFeeCents = 0,
  initialLogoLocations,
  initialCheckoutMemos,
  initialSupplierLines,
  initialMockupImages,
  initialReferenceImages,
  initialCustomerReferenceItems,
  initialOrderScanPayload = null,
  completeOrdersDocumentsView = false,
}: Props) {
  const [orderId, setOrderId] = useState(initialCustomerOrderId);
  const [orderScanPayload, setOrderScanPayload] = useState<string | null>(initialOrderScanPayload);
  const [organisationName, setOrganisationName] = useState(initialOrganisationName);
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerEmail, setCustomerEmail] = useState(initialCustomerEmail);
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"Pickup" | "Delivery">(initialFulfillmentMethod);
  const [deliveryAddress, setDeliveryAddress] = useState(initialDeliveryAddress);
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(initialDeliveryFeeCents);
  const [supplierLines, setSupplierLines] = useState<ClickUpSupplierLineRow[]>(initialSupplierLines);
  const [logoLocations, setLogoLocations] = useState(initialLogoLocations);
  const [checkoutMemos, setCheckoutMemos] = useState<StoreOrderCustomerMemoLine[]>(initialCheckoutMemos);
  const [sheetActionMessage, setSheetActionMessage] = useState<string | null>(null);
  const [moveToProductionBusy, setMoveToProductionBusy] = useState(false);
  const router = useRouter();
  const skipCustomerLookupOnceRef = useRef(false);

  useLayoutEffect(() => {
    const ld = initialListDate.trim();
    if (!ld || typeof window === "undefined") {
      return;
    }
    const oid = initialCustomerOrderId.trim() || "_";
    const raw = window.localStorage.getItem(clickUpDraftStorageKey(ld, oid));
    if (!raw) {
      return;
    }
    const draft = parseClickUpDraft(raw);
    if (!draft) {
      return;
    }
    skipCustomerLookupOnceRef.current = true;
     
    setOrderId(draft.orderId);
    setOrganisationName(draft.organisationName);
    setCustomerName(draft.customerName);
    setCustomerEmail(draft.customerEmail);
    setCustomerPhone(draft.customerPhone);
    setLogoLocations(draft.logoLocations);
     
  }, [initialListDate, initialCustomerOrderId]);

  useEffect(() => {
    setOrderScanPayload(initialOrderScanPayload);
  }, [initialOrderScanPayload]);

  useEffect(() => {
    const id = orderId.trim();
    let cancelled = false;

    if (!id) {
      const clearTimer = window.setTimeout(() => {
        if (!cancelled) {
          setOrganisationName("");
          setCustomerName("");
          setCustomerEmail("");
          setCustomerPhone("");
          setFulfillmentMethod("Delivery");
          setDeliveryAddress("");
          setDeliveryFeeCents(0);
          setLogoLocations("");
          setCheckoutMemos([]);
          setOrderScanPayload(null);
        }
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(clearTimer);
      };
    }

    const debounceTimer = window.setTimeout(() => {
      void (async () => {
        const result = await lookupCustomerByStoreOrderNumber(id);
        if (cancelled) return;
        if (!result.ok) {
          setOrderScanPayload(null);
          return;
        }
        setOrderScanPayload(result.orderScanPayload);
        setCheckoutMemos(result.checkoutMemos);
        setFulfillmentMethod(result.fulfillmentMethod);
        setDeliveryAddress(result.deliveryAddress);
        setDeliveryFeeCents(result.deliveryFeeCents);
        if (skipCustomerLookupOnceRef.current) {
          skipCustomerLookupOnceRef.current = false;
          return;
        }
        setOrganisationName(result.organisationName);
        setCustomerName(result.customerName);
        setCustomerEmail(result.customerEmail);
        setCustomerPhone(result.customerPhone);
        setLogoLocations(result.logoLocations);
      })();
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
    };
  }, [orderId]);

  useEffect(() => {
    const listDate = initialListDate.trim();
    let cancelled = false;

    if (!listDate) {
      const clearTimer = window.setTimeout(() => {
        if (!cancelled) {
          setSupplierLines([]);
        }
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(clearTimer);
      };
    }

    const oid = orderId.trim();
    const debounceTimer = window.setTimeout(() => {
      void (async () => {
        const result = await loadSupplierOrderLinesForClickUpSheet(listDate, oid || null);
        if (cancelled || !result.ok) return;
        setSupplierLines(result.lines);
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
    };
  }, [orderId, initialListDate]);

  function saveSheetDraft() {
    if (completeOrdersDocumentsView) {
      return;
    }
    const ld = initialListDate.trim();
    if (!ld) {
      setSheetActionMessage("Perth worksheet date가 있어야 저장할 수 있습니다.");
      window.setTimeout(() => setSheetActionMessage(null), 4000);
      return;
    }
    const oid = orderId.trim() || "_";
    const draft: ClickUpSheetDraftV1 = {
      v: 1,
      orderId,
      organisationName,
      customerName,
      customerEmail,
      customerPhone,
      logoLocations,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(clickUpDraftStorageKey(ld, oid), JSON.stringify(draft));
      setSheetActionMessage("Saved to this browser (Order & Logo draft).");
    } catch {
      setSheetActionMessage("Could not save (storage full or blocked).");
    }
    window.setTimeout(() => setSheetActionMessage(null), 4000);
  }

  function printSheet() {
    const pageStyle = document.createElement("style");
    pageStyle.id = "click-up-sheet-print-page";
    /* 10mm printable inset; paper size/orientation from the print dialog. */
    pageStyle.textContent = "@page { margin: 10mm; }";
    document.head.appendChild(pageStyle);
    const previousTitle = document.title;
    document.title = "";
    document.body.classList.add("click-up-sheet-print-mode");

    function cleanup() {
      document.body.classList.remove("click-up-sheet-print-mode");
      document.title = previousTitle;
      pageStyle.remove();
      window.removeEventListener("afterprint", cleanup);
    }
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  function alertMoveToProductionBlocked(body: string) {
    window.alert(`Move to Production — 확인이 필요합니다\n\n${body}`);
  }

  function confirmMoveToProductionAgain(): boolean {
    return window.confirm(
      "Move to Production — 확인이 필요합니다\n\n" +
        "이 주문은 이미 Production으로 이동한 적이 있습니다.\n" +
        "다시 Production pack으로 이동하시겠습니까?",
    );
  }

  async function moveToProduction() {
    if (completeOrdersDocumentsView) {
      return;
    }
    const id = orderId.trim();
    if (!id) {
      alertMoveToProductionBlocked("Order ID를 입력한 뒤 Production으로 이동할 수 있습니다.");
      return;
    }

    const queueStatus = await storeOrderProductionQueueStatus(id);
    if (!queueStatus.ok) {
      alertMoveToProductionBlocked(queueStatus.error);
      return;
    }
    if (queueStatus.inProductionQueue && !confirmMoveToProductionAgain()) {
      return;
    }

    setSheetActionMessage(null);
    setMoveToProductionBusy(true);
    notifyRouteLoadingStart({
      overlay: {
        title: "Moving to Production...",
        description: "Opening the production pack for this order.",
      },
      immediate: true,
    });
    try {
      const result = await moveClickUpSheetOrderToProduction(id, initialListDate.trim());
      if (!result.ok) {
        stopRouteLoading();
        setMoveToProductionBusy(false);
        alertMoveToProductionBlocked(result.error);
        return;
      }
      router.push(`/admin/production/${result.productionOrderId}`);
      router.refresh();
      // Keep busy/spinner until navigation replaces this page.
    } catch {
      stopRouteLoading();
      setMoveToProductionBusy(false);
      alertMoveToProductionBlocked("Could not move to Production.");
    }
  }

  const sheetActionBtnClass =
    "rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-8">
      <header className="print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <Link href="/admin" className="text-brand-orange hover:underline">
                Dashboard
              </Link>{" "}
              /{" "}
              <Link href="/admin/work-process" className="text-brand-orange hover:underline">
                Click Up
              </Link>{" "}
              / Click up sheet
            </p>
            <h1 className="mt-1 text-3xl font-medium text-brand-navy">Click up sheet</h1>
            {completeOrdersDocumentsView ? (
              <p className="mt-3 max-w-2xl rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>Completed Order 문서 보기</strong> 모드입니다. 저장·Production 이동·이미지 업로드는 사용할 수
                없습니다.
              </p>
            ) : null}
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              <strong>Order ID</strong>는 스토어 주문 번호(<span className="font-mono">store_orders.order_number</span>)와
              맞출 때 회사명·로고 위치 등은 같은 이메일의 CRM 프로필(
              <span className="font-mono">customer_profiles</span>)에서 불러옵니다. Order·Logo &amp; artwork는 DB에 저장되지 않으며, 우측
              상단 <strong>SAVE</strong>로 이 브라우저(localStorage)에 초안만 보관할 수 있습니다.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 print:hidden">
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={completeOrdersDocumentsView}
                onClick={saveSheetDraft}
                className={`${sheetActionBtnClass} border border-brand-navy bg-brand-navy text-white hover:bg-brand-navy/90`}
              >
                SAVE
              </button>
              <button
                type="button"
                onClick={printSheet}
                className={`${sheetActionBtnClass} border border-slate-300 bg-white text-brand-navy hover:bg-slate-50`}
              >
                PRINT
              </button>
              <button
                type="button"
                disabled={completeOrdersDocumentsView || moveToProductionBusy || !orderId.trim()}
                onClick={() => void moveToProduction()}
                className={`${sheetActionBtnClass} border border-brand-orange bg-brand-orange text-brand-navy hover:brightness-95`}
                title={
                  !orderId.trim()
                    ? "스토어 주문 번호(Order ID)를 입력하세요."
                    : "해당 주문의 Production pack으로 이동합니다."
                }
              >
                {moveToProductionBusy ? "…" : "Move to Production"}
              </button>
            </div>
            {sheetActionMessage ? (
              <p className="max-w-[min(100%,20rem)] text-right text-xs text-slate-600" role="status">
                {sheetActionMessage}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="click-up-sheet-print-area space-y-8">
        {initialListDate ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 print:bg-white">
            Perth worksheet date:{" "}
            <span className="font-mono font-semibold text-brand-navy">{initialListDate}</span>
          </p>
        ) : null}

        <div className="space-y-6">
          {orderScanPayload ? (
            <div className="click-up-sheet-print-order-barcode">
              <StoreOrderBarcode
                large
                value={orderScanPayload}
                className="max-w-[min(100%,36rem)]"
              />
            </div>
          ) : null}

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Order</h2>
          <div className="click-up-sheet-print-order-4 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
            <div className="min-w-0">
              <label htmlFor="cus-order-id" className="text-[1.125rem] font-medium text-slate-600">
                Order ID
              </label>
              <input
                id="cus-order-id"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-[1.3125rem]"
                placeholder="e.g. store order # / internal ID"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="cus-org" className="text-[1.125rem] font-medium text-slate-600">
                Company Name
              </label>
              <input
                id="cus-org"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[1.3125rem]"
                placeholder="Company name"
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="cus-name" className="text-[1.125rem] font-medium text-slate-600">
                Customer name
              </label>
              <input
                id="cus-name"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[1.3125rem]"
                placeholder="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="cus-phone" className="text-[1.125rem] font-medium text-slate-600">
                Phone
              </label>
              <input
                id="cus-phone"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[1.3125rem]"
                placeholder="Phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="cus-email" className="text-[1.125rem] font-medium text-slate-600">
                Email
              </label>
              <input
                id="cus-email"
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[1.3125rem]"
                placeholder="Email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <p id="cus-order-type-label" className="text-[1.125rem] font-medium text-slate-600">
                Order Type
              </p>
              <div
                role="group"
                aria-labelledby="cus-order-type-label"
                className="mt-1 flex min-h-[2.75rem] w-full items-center gap-6 rounded-lg border border-slate-200 px-3 py-2 text-[1.3125rem]"
              >
                <label className="inline-flex cursor-pointer items-center gap-2 text-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-orange focus:ring-brand-orange/40"
                    checked={fulfillmentMethod === "Pickup"}
                    onChange={() => setFulfillmentMethod("Pickup")}
                  />
                  <span>Pick Up</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-orange focus:ring-brand-orange/40"
                    checked={fulfillmentMethod === "Delivery"}
                    onChange={() => setFulfillmentMethod("Delivery")}
                  />
                  <span>Delivery</span>
                </label>
              </div>
            </div>
            <div className="min-w-0">
              <label htmlFor="cus-delivery-address" className="text-[1.125rem] font-medium text-slate-600">
                Delivery address
              </label>
              <textarea
                id="cus-delivery-address"
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[1.3125rem] leading-snug"
                placeholder="Delivery address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="cus-delivery-fee" className="text-[1.125rem] font-medium text-slate-600">
                Delivery fee paid
              </label>
              <input
                id="cus-delivery-fee"
                readOnly
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[1.3125rem] tabular-nums text-slate-800"
                value={
                  deliveryFeeCents <= 0 ? "Free / $0.00" : formatMoneyFromCents(deliveryFeeCents, "AUD")
                }
              />
            </div>
          </div>
        </section>
        </div>

        <section className="click-up-sheet-print-supplier-section rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Customer order list &amp; quantity
          </h2>
          <p className="click-up-sheet-print-hide mt-1 text-xs text-slate-600">
            <strong>Supplier orders</strong> 워크시트(같은 Perth <span className="font-mono">list_date</span>)와 동일한 행입니다.
            Order ID가 있으면 그 주문 번호가 일치하는 행만 표시합니다. 읽기 전용입니다.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            {!initialListDate ? (
              <p className="click-up-sheet-print-hide px-4 py-8 text-center text-sm text-slate-600">
                워크시트 날짜(<span className="font-mono">list_date</span>)가 없습니다. Click Up에서 시트를 열 때 URL에 날짜가 포함되는지
                확인하세요.
              </p>
            ) : supplierLines.length === 0 ? (
              <p className="click-up-sheet-print-hide px-4 py-8 text-center text-sm text-slate-600">
                이 날짜
                {orderId.trim() ? (
                  <>
                    {" "}
                    · Order ID <span className="font-mono">{orderId.trim()}</span>
                  </>
                ) : null}
                에 해당하는 supplier 행이 없습니다.
              </p>
            ) : (
              <table className="click-up-sheet-print-table w-full min-w-[860px] text-left text-[1.3125rem]">
                <thead className="border-b border-slate-200 bg-slate-50 text-[1.125rem] font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="w-12 px-2 py-2 text-center tabular-nums">#</th>
                    <th className="px-2 py-2">Supplier name</th>
                    <th className="px-2 py-2">Product ID</th>
                    <th className="px-2 py-2">Colour</th>
                    <th className="px-2 py-2">Size</th>
                    <th className="w-24 px-2 py-2">Qty</th>
                    <th className="w-28 px-2 py-2">Ordered</th>
                    <th className="w-28 px-2 py-2">Received</th>
                    <th className="w-28 px-2 py-2">Unit (AUD)</th>
                    <th className="w-28 px-2 py-2">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierLines.map((row, idx) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 text-center align-top font-mono text-[1.125rem] tabular-nums text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-2 align-top text-[1.125rem] uppercase text-slate-800">
                        {normalizeSupplierOrderLineSupplierValue(row.supplier)}
                      </td>
                      <td className="px-2 py-2 align-top text-[1.125rem]">
                        <ProductIdReadonly raw={row.product_id} />
                      </td>
                      <td className="px-2 py-2 align-top text-[1.125rem] text-slate-800">{row.colour || "—"}</td>
                      <td className="px-2 py-2 align-top text-[1.125rem] text-slate-800">{row.size || "—"}</td>
                      <td className="px-2 py-2 align-top font-mono text-[1.125rem] text-slate-800">{row.quantity}</td>
                      <td className="px-2 py-2 align-top font-mono text-[1.125rem] text-slate-700">
                        {row.ordered_date ?? "—"}
                      </td>
                      <td className="px-2 py-2 align-top font-mono text-[1.125rem] text-slate-700">
                        {row.received_date ?? "—"}
                      </td>
                      <td className="px-2 py-2 align-top font-mono text-[1.125rem] text-slate-700">
                        {aud.format(Math.max(0, row.unit_price_cents) / 100)}
                      </td>
                      <td className="px-2 py-2 align-top font-mono text-[1.125rem] text-slate-700">
                        {aud.format(lineTotalCents(row) / 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className="click-up-sheet-print-logo-ref-row grid min-w-0 grid-cols-1 gap-6 lg:col-span-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Logo &amp; artwork</h2>
          <div className="mt-4">
            <label htmlFor="logo-loc" className="text-xs font-medium text-slate-600">
              Logo locations
            </label>
            <textarea
              id="logo-loc"
              rows={9}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Chest left, back, sleeve…"
              value={logoLocations}
              onChange={(e) => setLogoLocations(e.target.value)}
            />
          </div>
          <div className="mt-6 border-t border-slate-100 pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Memo</h3>
            <p className="click-up-sheet-print-hide mt-1 text-xs text-slate-600" suppressHydrationWarning>
              체크아웃 시 고객이 라인별로 입력한 내용(<span className="font-mono">store_order_items.notes</span>)입니다. 내용이 같은
              메모는 한 번만 표시합니다. 읽기 전용입니다.
            </p>
            {!orderId.trim() ? (
              <p className="click-up-sheet-print-hide mt-3 text-sm text-slate-500">Order ID가 있으면 표시됩니다.</p>
            ) : checkoutMemos.length === 0 ? (
              <p className="click-up-sheet-print-hide mt-3 text-sm text-slate-500">이 주문에 저장된 메모가 없습니다.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {checkoutMemos.map((row, idx) => (
                  <li
                    key={`memo-${idx}`}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-800"
                  >
                    <p className="whitespace-pre-wrap text-slate-800">{row.notes ?? ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <ClickUpSheetCustomerReferenceSection
          customerOrderId={orderId}
          initialItems={initialCustomerReferenceItems}
        />
        </div>

        <div className="click-up-sheet-print-span-2 min-w-0 lg:col-span-2">
          <ClickUpSheetImagesSection
            listDateYmd={initialListDate}
            customerOrderId={orderId}
            initialImages={initialReferenceImages}
            variant="reference"
            readOnly={completeOrdersDocumentsView}
          />
        </div>

        <div className="click-up-sheet-print-span-2 min-w-0 lg:col-span-2">
          <ClickUpSheetImagesSection
            listDateYmd={initialListDate}
            customerOrderId={orderId}
            initialImages={initialMockupImages}
            variant="mockup"
            readOnly={completeOrdersDocumentsView}
          />
        </div>

        <div className="click-up-sheet-print-span-2 min-w-0 lg:col-span-2">
          <ClickUpSheetLogoFileLinksSection
            customerOrderId={orderId}
            readOnly={completeOrdersDocumentsView}
          />
        </div>
      </div>
    </div>
  );
}

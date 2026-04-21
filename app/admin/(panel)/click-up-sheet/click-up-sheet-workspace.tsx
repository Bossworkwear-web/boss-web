"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { StoreOrderCustomerMemoLine } from "@/lib/store-order-customer-detail";
import { supplierOrderProductIdHeadTail } from "@/lib/supplier-order-product-id-parts";
import { normalizeSupplierOrderLineSupplierValue } from "@/lib/supplier-order-supplier-normalize";

import {
  loadSupplierOrderLinesForClickUpSheet,
  lookupCustomerByStoreOrderNumber,
  moveClickUpSheetOrderToProduction,
  type ClickUpSheetImageDto,
  type ClickUpSupplierLineRow,
  type CustomerReferenceVisualDto,
} from "./actions";
import { ClickUpSheetCustomerReferenceSection } from "./click-up-sheet-customer-reference-section";
import { ClickUpSheetImagesSection } from "./click-up-sheet-images-section";

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
  embroideryLogoId: string;
  printingLogoId: string;
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
      embroideryLogoId: typeof d.embroideryLogoId === "string" ? d.embroideryLogoId : "",
      printingLogoId: typeof d.printingLogoId === "string" ? d.printingLogoId : "",
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
  initialLogoLocations: string;
  initialCheckoutMemos: StoreOrderCustomerMemoLine[];
  initialSupplierLines: ClickUpSupplierLineRow[];
  initialMockupImages: ClickUpSheetImageDto[];
  initialReferenceImages: ClickUpSheetImageDto[];
  initialCustomerReferenceItems: CustomerReferenceVisualDto[];
  /** Opened from Complete Orders → Pre-process documents: view-only UI (mutations also blocked server-side). */
  completeOrdersDocumentsView?: boolean;
};

export function ClickUpSheetWorkspace({
  initialListDate,
  initialCustomerOrderId,
  initialOrganisationName,
  initialLogoLocations,
  initialCheckoutMemos,
  initialSupplierLines,
  initialMockupImages,
  initialReferenceImages,
  initialCustomerReferenceItems,
  completeOrdersDocumentsView = false,
}: Props) {
  const [orderId, setOrderId] = useState(initialCustomerOrderId);
  const [organisationName, setOrganisationName] = useState(initialOrganisationName);
  const [supplierLines, setSupplierLines] = useState<ClickUpSupplierLineRow[]>(initialSupplierLines);
  const [embroideryLogoId, setEmbroideryLogoId] = useState("");
  const [printingLogoId, setPrintingLogoId] = useState("");
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
    /* eslint-disable react-hooks/set-state-in-effect -- restore draft from localStorage once */
    setOrderId(draft.orderId);
    setOrganisationName(draft.organisationName);
    setEmbroideryLogoId(draft.embroideryLogoId);
    setPrintingLogoId(draft.printingLogoId);
    setLogoLocations(draft.logoLocations);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialListDate, initialCustomerOrderId]);

  useEffect(() => {
    const id = orderId.trim();
    let cancelled = false;

    if (!id) {
      const clearTimer = window.setTimeout(() => {
        if (!cancelled) {
          setOrganisationName("");
          setLogoLocations("");
          setCheckoutMemos([]);
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
        if (cancelled || !result.ok) return;
        setCheckoutMemos(result.checkoutMemos);
        if (skipCustomerLookupOnceRef.current) {
          skipCustomerLookupOnceRef.current = false;
          return;
        }
        setOrganisationName(result.organisationName);
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
      embroideryLogoId,
      printingLogoId,
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
    /* margin 0: maximize drawable area; paper size/orientation come from the browser print dialog (no forced landscape). */
    pageStyle.textContent = "@page { margin: 0; }";
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

  async function moveToProduction() {
    if (completeOrdersDocumentsView) {
      return;
    }
    const id = orderId.trim();
    if (!id) {
      setSheetActionMessage("Order ID를 입력한 뒤 Production으로 이동할 수 있습니다.");
      window.setTimeout(() => setSheetActionMessage(null), 5000);
      return;
    }
    setSheetActionMessage(null);
    setMoveToProductionBusy(true);
    const result = await moveClickUpSheetOrderToProduction(id, initialListDate.trim());
    setMoveToProductionBusy(false);
    if (!result.ok) {
      setSheetActionMessage(result.error);
      window.setTimeout(() => setSheetActionMessage(null), 6000);
      return;
    }
    router.push(`/admin/production/${result.productionOrderId}`);
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
                <strong>Complete Orders 문서 보기</strong> 모드입니다. 저장·Production 이동·이미지 업로드는 사용할 수
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

        <div className="click-up-sheet-print-grid grid gap-6 lg:grid-cols-2">
        <section className="click-up-sheet-print-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2 print:shadow-none">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Order</h2>
          <div className="click-up-sheet-print-order-4 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4">
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
              <label htmlFor="emb-id" className="text-[1.125rem] font-medium text-slate-600">
                Embroidery Logo File
              </label>
              <input
                id="emb-id"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-[1.3125rem]"
                placeholder="—"
                value={embroideryLogoId}
                onChange={(e) => setEmbroideryLogoId(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="prt-id" className="text-[1.125rem] font-medium text-slate-600">
                Printing Logo File
              </label>
              <input
                id="prt-id"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-[1.3125rem]"
                placeholder="—"
                value={printingLogoId}
                onChange={(e) => setPrintingLogoId(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="click-up-sheet-print-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2 print:shadow-none">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Customer order list &amp; quantity
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            <strong>Supplier orders</strong> 워크시트(같은 Perth <span className="font-mono">list_date</span>)와 동일한 행입니다.
            Order ID가 있으면 그 주문 번호가 일치하는 행만 표시합니다. 읽기 전용입니다.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            {!initialListDate ? (
              <p className="px-4 py-8 text-center text-sm text-slate-600">
                워크시트 날짜(<span className="font-mono">list_date</span>)가 없습니다. Click Up에서 시트를 열 때 URL에 날짜가 포함되는지
                확인하세요.
              </p>
            ) : supplierLines.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-600">
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
            <p className="mt-1 text-xs text-slate-600" suppressHydrationWarning>
              체크아웃 시 고객이 라인별로 입력한 내용(<span className="font-mono">store_order_items.notes</span>)입니다. 내용이 같은
              메모는 한 번만 표시합니다. 읽기 전용입니다.
            </p>
            {!orderId.trim() ? (
              <p className="mt-3 text-sm text-slate-500">Order ID가 있으면 표시됩니다.</p>
            ) : checkoutMemos.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">이 주문에 저장된 메모가 없습니다.</p>
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
        </div>
      </div>
    </div>
  );
}

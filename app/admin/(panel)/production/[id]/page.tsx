import Link from "next/link";
import { notFound } from "next/navigation";

import { moveStoreOrderToQualityControlFromProduction } from "@/app/admin/(panel)/quality-control/actions";
import { completeOrdersDocFromSearchParam } from "@/lib/complete-orders-doc-query";
import { serviceTypeColoredContent } from "@/lib/service-type-colored";
import { createSupabaseAdminClient } from "@/lib/supabase";

import { StoreOrderBarcode } from "@/app/components/store-order-barcode";
import { storeOrderScanPayloadFromId } from "@/lib/store-order-scan-code";

import { hasProductionPackForStoreOrder } from "../actions";
import { ProductionPackNotStarted } from "./production-pack-not-started";
import { ProductionWorkspace } from "./production-workspace";
import { PrintButton } from "../print-button";

export const dynamic = "force-dynamic";

/** Matches `click-up-sheet-workspace.tsx` action buttons (`sheetActionBtnClass`). */
const PRODUCTION_PACK_ACTION_BTN_CLASS =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50";

type ProductionOrderSearch = { qc_move_error?: string; complete_orders_doc?: string };

export default async function AdminProductionOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<ProductionOrderSearch>;
}) {
  const { id } = await params;
  const orderId = (id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    notFound();
  }

  let organisationName = "";

  let order:
    | {
        id: string;
        order_number: string;
        customer_email: string;
      }
    | null = null;
  let items:
    | {
        id: string;
        product_name: string;
        quantity: number;
        color: string | null;
        size: string | null;
        service_type: string | null;
        placements: unknown;
      }[]
    | null = null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data: o } = await supabase
      .from("store_orders")
      .select("id, order_number, customer_email")
      .eq("id", orderId)
      .maybeSingle();
    order = o ?? null;

    const emailRaw = (o?.customer_email ?? "").trim();
    if (emailRaw) {
      const emailLower = emailRaw.toLowerCase();
      const { data: profEq } = await supabase
        .from("customer_profiles")
        .select("organisation")
        .eq("email_address", emailLower)
        .maybeSingle();
      const orgEq = profEq?.organisation?.trim();
      if (orgEq) {
        organisationName = orgEq;
      } else {
        const { data: profIlike } = await supabase
          .from("customer_profiles")
          .select("organisation")
          .ilike("email_address", emailRaw)
          .maybeSingle();
        organisationName = profIlike?.organisation?.trim() ?? "";
      }
    }

    const { data: its } = await supabase
      .from("store_order_items")
      .select("id, product_name, quantity, color, size, service_type, placements")
      .eq("order_id", orderId)
      .order("sort_order", { ascending: true });
    items = its ?? [];
  } catch {
    order = null;
    items = null;
  }

  if (!order) {
    notFound();
  }

  const orderScanPayload = storeOrderScanPayloadFromId(order.id);

  const spEarly = searchParams ? await searchParams : {};
  const completeOrdersDocumentsView = completeOrdersDocFromSearchParam(spEarly.complete_orders_doc);

  const packStarted = await hasProductionPackForStoreOrder(orderId);
  if (!packStarted) {
    return (
      <div className="production-pack-print-area space-y-4 py-8">
        {completeOrdersDocumentsView ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 print:hidden">
            Complete Orders 문서 보기 모드: 생산 팩이 시작되지 않은 주문입니다. 아래는 참고용입니다.
          </div>
        ) : null}
        <ProductionPackNotStarted orderNumber={order.order_number} />
      </div>
    );
  }

  const sp = spEarly;
  const qcMoveErrorRaw = (sp.qc_move_error ?? "").trim();
  let qcMoveError: string | null = null;
  if (qcMoveErrorRaw === "invalid_order") {
    qcMoveError = "Invalid order — refresh the page and try Move to QC again.";
  } else if (qcMoveErrorRaw) {
    try {
      qcMoveError = decodeURIComponent(qcMoveErrorRaw.replace(/\+/g, " "));
    } catch {
      qcMoveError = qcMoveErrorRaw;
    }
  }

  return (
    <div className="production-pack-print-area min-w-0 max-w-full space-y-6">
      <header className="min-w-0 space-y-2">
        {qcMoveError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 print:hidden">
            {qcMoveError}
          </div>
        ) : null}
        {completeOrdersDocumentsView ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 print:hidden">
            Complete Orders 문서 보기 모드: 생산 파일 업로드·삭제 및 Move to QC는 비활성화됩니다.
          </div>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <Link href="/admin/production" className="text-brand-orange hover:underline">
                Production
              </Link>{" "}
              / {order.order_number}
            </p>
            <h1 className="mt-1 text-3xl font-medium text-brand-navy">Production pack</h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 print:hidden">
            <div className="flex flex-wrap justify-end gap-2">
              <PrintButton
                productionPack
                className={`${PRODUCTION_PACK_ACTION_BTN_CLASS} border border-slate-300 bg-white text-brand-navy hover:bg-slate-50`}
              >
                Print production pack
              </PrintButton>
              {!completeOrdersDocumentsView ? (
                <form action={moveStoreOrderToQualityControlFromProduction} className="inline-flex">
                  <input type="hidden" name="store_order_id" value={orderId} />
                  <button
                    type="submit"
                    className={`${PRODUCTION_PACK_ACTION_BTN_CLASS} border border-brand-orange bg-brand-orange text-brand-navy hover:brightness-95`}
                  >
                    Move to QC
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
        {organisationName ? (
          <div className="flex flex-wrap items-end gap-6 gap-y-4">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm text-slate-600">
                <span className="production-pack-print-name-label text-slate-500">Company</span>{" "}
                <span className="production-pack-company-name mt-1 block text-[2.625rem] font-semibold leading-tight text-brand-navy">
                  {organisationName}
                </span>
              </p>
              <p className="production-pack-print-order-id font-mono text-[1.75rem] font-semibold leading-snug tracking-tight text-brand-navy">
                Order ID: {order.order_number}
              </p>
            </div>
            <StoreOrderBarcode value={orderScanPayload} className="shrink-0 print:max-w-[min(100%,14rem)]" />
          </div>
        ) : (
          <StoreOrderBarcode value={orderScanPayload} className="print:max-w-[min(100%,14rem)]" />
        )}
      </header>

      <section className="min-w-0 max-w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <p className="text-sm font-semibold text-brand-navy print:hidden">Order items</p>

        <div className="mt-4 min-w-0 max-w-full overflow-x-auto">
          <table className="production-pack-order-items-table min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="w-12 px-4 py-3 text-center tabular-nums">#</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 w-24">Qty</th>
                <th className="px-4 py-3 w-44">Color</th>
                <th className="px-4 py-3 w-32">Size</th>
                <th className="px-4 py-3 w-44">Service</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((it, idx) => (
                <tr key={it.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3 text-center font-mono tabular-nums text-slate-600">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-brand-navy">{it.product_name}</td>
                  <td className="px-4 py-3 tabular-nums">{it.quantity}</td>
                  <td className="px-4 py-3">{it.color ?? "—"}</td>
                  <td className="px-4 py-3">{it.size ?? "—"}</td>
                  <td className="px-4 py-3">{serviceTypeColoredContent(it.service_type)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ProductionWorkspace
        orderId={orderId}
        orderNumber={order.order_number}
        completeOrdersDocumentsView={completeOrdersDocumentsView}
      />
    </div>
  );
}


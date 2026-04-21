import Link from "next/link";

import { StoreOrderBarcode } from "@/app/components/store-order-barcode";
import { completeOrdersDocFromSearchParam } from "@/lib/complete-orders-doc-query";
import { storeOrderScanPayloadFromId } from "@/lib/store-order-scan-code";
import { createSupabaseAdminClient } from "@/lib/supabase";

import { MoveToDispatchForm } from "./move-to-dispatch-form";
import { QualityCheckChecklist } from "./quality-check-checklist";
import { QualityCheckInspection } from "./quality-check-inspection";
import { QualityCheckNotes } from "./quality-check-notes";

export const dynamic = "force-dynamic";

type Search = {
  list_date?: string;
  customer_order_id?: string;
  dispatch_move_error?: string;
  /** @deprecated Legacy query key; still read for older bookmarks. */
  delivery_move_error?: string;
  complete_orders_doc?: string;
};

export default async function AdminQualityCheckSheetPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const q = await searchParams;
  const listDate = (q.list_date ?? "").trim();
  const customerOrderId = (q.customer_order_id ?? "").trim();
  const completeOrdersDocumentsView = completeOrdersDocFromSearchParam(q.complete_orders_doc);
  const hasOrderContext = listDate.length > 0 && customerOrderId.length > 0;
  const dispatchMoveErrorRaw = (q.dispatch_move_error ?? q.delivery_move_error ?? "").trim();
  let dispatchMoveError: string | null = null;
  if (dispatchMoveErrorRaw === "missing_list_date_or_order_id") {
    dispatchMoveError = "List date와 Customer order ID가 모두 필요합니다.";
  } else if (dispatchMoveErrorRaw === "inspection_not_completed") {
    dispatchMoveError = "먼저 Complete inspection으로 검사를 저장한 뒤 Move to Dispatch를 사용하세요.";
  } else if (dispatchMoveErrorRaw) {
    try {
      dispatchMoveError = decodeURIComponent(dispatchMoveErrorRaw.replace(/\+/g, " "));
    } catch {
      dispatchMoveError = dispatchMoveErrorRaw;
    }
  }

  let orderScanPayload: string | null = null;
  if (customerOrderId) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("store_orders")
        .select("id")
        .eq("order_number", customerOrderId)
        .maybeSingle();
      if (data?.id) {
        orderScanPayload = storeOrderScanPayloadFromId(data.id);
      }
    } catch {
      /* Supabase not configured or query failed */
    }
  }

  return (
    <main className="space-y-6">
      <nav className="text-sm text-slate-600">
        <Link href="/admin/quality-control" className="font-semibold text-brand-orange hover:underline">
          Quality Control
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <Link href="/admin/work-process" className="font-semibold text-brand-orange hover:underline">
          Work process
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-brand-navy">Quality Check sheet</span>
      </nav>
      {dispatchMoveError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 print:hidden">
          {dispatchMoveError}
        </div>
      ) : null}
      {completeOrdersDocumentsView ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 print:hidden">
          Complete Orders 문서 보기 모드: 체크리스트·메모·검사 저장 및 Move to Dispatch는 비활성화됩니다.
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-medium text-brand-navy">Quality Check sheet</h1>
          <p className="mt-2 text-sm text-slate-600">
            품질 점검용 화면입니다. 워크시트 날짜와 주문 ID는 아래와 같습니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-end justify-end gap-4">
          {orderScanPayload ? (
            <StoreOrderBarcode value={orderScanPayload} compact className="max-w-[min(100%,16rem)]" />
          ) : null}
          {hasOrderContext ? (
            <MoveToDispatchForm
              listDate={listDate}
              customerOrderId={customerOrderId}
              completeOrdersDocumentsView={completeOrdersDocumentsView}
            />
          ) : null}
        </div>
      </div>
      <div className="hidden print:block">
        <h1 className="text-3xl font-medium text-brand-navy">Quality Check sheet</h1>
        <p className="mt-2 text-sm text-slate-600">
          품질 점검용 화면입니다. 워크시트 날짜와 주문 ID는 아래와 같습니다.
        </p>
        {orderScanPayload ? (
          <div className="mt-3">
            <StoreOrderBarcode value={orderScanPayload} compact className="max-w-[min(100%,16rem)]" />
          </div>
        ) : null}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">List date</dt>
            <dd className="mt-1 font-mono text-brand-navy">{listDate || "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Customer order ID</dt>
            <dd className="mt-1 font-mono text-brand-navy">{customerOrderId || "—"}</dd>
          </div>
        </dl>
        {orderScanPayload ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <StoreOrderBarcode value={orderScanPayload} className="max-w-[min(100%,18rem)]" />
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <QualityCheckChecklist
          listDate={listDate}
          customerOrderId={customerOrderId}
          completeOrdersDocumentsView={completeOrdersDocumentsView}
        />
        {hasOrderContext ? (
          <div className="mt-8 border-t border-slate-200 pt-8">
            <QualityCheckNotes
              listDate={listDate}
              customerOrderId={customerOrderId}
              completeOrdersDocumentsView={completeOrdersDocumentsView}
            />
          </div>
        ) : null}
      </div>

      {hasOrderContext ? (
        <QualityCheckInspection
          listDate={listDate}
          customerOrderId={customerOrderId}
          completeOrdersDocumentsView={completeOrdersDocumentsView}
        />
      ) : null}
    </main>
  );
}

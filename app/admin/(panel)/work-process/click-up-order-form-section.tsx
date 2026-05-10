import Link from "next/link";

import { ClickUpOrderFormTableClient } from "./click-up-order-form-table-client";

export type ClickUpOrderFormRow = {
  listDate: string;
  customerOrderId: string;
  /** `store_orders.id` when this customer order ID matches a store order; used for delivery docket. */
  storeOrderId: string | null;
  storeOrderDateDisplay: string;
  organisationName: string;
  customerName: string;
  /**
   * Where the order sits in the pipeline (read-only): Click up, Production, Quality control, or Dispatch.
   * Completed orders are not listed here.
   */
  processingStageLabel: string;
};

export function ClickUpOrderFormSection({
  rows,
  sheetsReady,
}: {
  rows: ClickUpOrderFormRow[];
  /** True when at least one worksheet is on the Click up list (Ready for Processing). */
  sheetsReady: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="click-up-order-form-heading">
      <h2 id="click-up-order-form-heading" className="text-base font-semibold text-brand-navy">
        Click up Order Form
      </h2>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          Supplier 워크시트에 입력된 <strong>Customer order ID</strong>와 스토어 주문·CRM 프로필을 연결한 목록입니다. 표 위 검색으로{" "}
          <strong>워크시트 날짜</strong>, <strong>스토어 주문일</strong>, <strong>회사명</strong>, <strong>고객명</strong>, 처리 단계 또는 주문
          ID로 행을 좁힌 뒤, <strong>Open Click up sheet</strong>로 해당 Click up sheet를 엽니다.{" "}
          <strong>Processing Stage</strong> 열은 읽기 전용이며, Production · Quality control · Dispatch 대기열 상태를 보여 줍니다 (스토어 주문이
          없으면 —).
        </p>

        {!sheetsReady ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-600">
            아직 Ready for Processing인 워크시트가 없습니다.{" "}
            <Link href="/admin/supplier-orders" className="font-semibold text-brand-orange hover:underline">
              Supplier orders
            </Link>
            에서 먼저 시트를 준비해 주세요.
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-amber-200 bg-amber-50/80 px-4 py-6 text-center text-sm text-amber-950">
            이 목록에 표시할 스토어 주문이 없습니다. Supplier 라인에 <strong>Customer order ID</strong>(스토어{" "}
            <span className="font-mono">order_number</span>)가 채워진 행이 있으면 여기에 나타납니다.
          </p>
        ) : (
          <div className="mt-4">
            <ClickUpOrderFormTableClient rows={rows} />
          </div>
        )}
      </div>
    </section>
  );
}

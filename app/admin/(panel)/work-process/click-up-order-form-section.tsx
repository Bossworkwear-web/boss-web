import Link from "next/link";

export type ClickUpOrderFormRow = {
  listDate: string;
  customerOrderId: string;
  /** `store_orders.id` when this customer order ID matches a store order; used for delivery docket. */
  storeOrderId: string | null;
  storeOrderDateDisplay: string;
  organisationName: string;
  customerName: string;
  /** Row exists in `click_up_production_queue` (Click up sheet → Move to Production). Read-only UI. */
  movedToProduction: boolean;
};

function rowKey(row: ClickUpOrderFormRow) {
  return `${row.listDate}::${row.customerOrderId}`;
}

function clickUpSheetHref(row: ClickUpOrderFormRow) {
  return `/admin/click-up-sheet?${new URLSearchParams({
    list_date: row.listDate,
    customer_order_id: row.customerOrderId,
  }).toString()}`;
}

function OrderFormTable({ rows }: { rows: ClickUpOrderFormRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Store order date</th>
            <th className="px-4 py-3">Customer order ID</th>
            <th className="px-4 py-3">Company Name</th>
            <th className="px-4 py-3">Customer name</th>
            <th
              className="w-px whitespace-nowrap px-4 py-3 text-center"
              title="Click up sheet에서 Move to Production을 누르면 빨간 체크 표시가 나타납니다."
            >
              Move to Production
            </th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="bg-white hover:bg-slate-50/80">
              <td className="whitespace-nowrap px-4 py-3 text-slate-800">{row.storeOrderDateDisplay}</td>
              <td className="px-4 py-3 font-mono text-xs text-brand-navy">{row.customerOrderId}</td>
              <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={row.organisationName}>
                {row.organisationName}
              </td>
              <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={row.customerName}>
                {row.customerName}
              </td>
              <td className="px-4 py-3 text-center align-middle">
                {row.movedToProduction ? (
                  <span
                    className="inline-flex items-center justify-center text-red-600"
                    role="img"
                    aria-label="Move to Production, completed"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="text-sm text-slate-300 tabular-nums" aria-label="Move to Production, not started">
                    —
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <Link
                  href={clickUpSheetHref(row)}
                  className="inline-flex rounded-lg bg-brand-orange px-3 py-2 text-xs font-semibold text-brand-navy transition hover:brightness-95"
                >
                  Open Click up sheet
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
          Supplier 워크시트에 입력된 <strong>Customer order ID</strong>와 스토어 주문·CRM 프로필을 연결한 목록입니다. 행마다{" "}
          <strong>Open Click up sheet</strong>로 해당 워크시트 날짜와 주문 ID가 채워진 작업 화면을 엽니다.{" "}
          <strong>Move to Production</strong> 열은 읽기 전용이며, 시트에서 해당 버튼을 눌러 Production으로 넘긴 뒤 빨간
          체크 표시(✓)가 나타납니다.
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
            <OrderFormTable rows={rows} />
          </div>
        )}
      </div>
    </section>
  );
}

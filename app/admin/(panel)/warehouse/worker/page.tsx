import Link from "next/link";

export default function WarehouseWorkerPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          /{" "}
          <Link href="/admin/warehouse" className="text-brand-orange hover:underline">
            Warehouse
          </Link>{" "}
          / Worker
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">창고 작업자</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          피킹·패킹·출고 준비에 필요한 화면으로 바로 이동합니다. 작업자도 <strong>동일한 Admin 로그인</strong>을 사용합니다(비밀번호는 운영 정책에 따라 공유하거나 계정을 나눌 수 있습니다).
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-navy">작업 흐름 (예시)</h2>
        <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-slate-700">
          <li>
            <strong>Store orders</strong>에서 결제 완료 주문 확인 → 라인별 수량·주소 확인
          </li>
          <li>
            <strong>Stock</strong>에서 수량 확인 후 피킹
          </li>
          <li>배송 도크(Docket) 출력이 필요하면 해당 주문 상세에서 진행</li>
        </ol>
      </section>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/admin/warehouse/worker/order-mockups"
          className="flex-1 rounded-xl border-2 border-brand-navy/25 bg-white px-6 py-4 text-center text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50"
        >
          <span className="block text-base">Order mock-ups</span>
          <span className="mt-1 block text-xs font-normal text-slate-600">
            View design mock-ups by store order number (from Click up sheet)
          </span>
        </Link>
        <Link
          href="/admin/warehouse/worker/store-orders"
          className="flex-1 rounded-xl bg-brand-orange px-6 py-4 text-center text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95"
        >
          <span className="block text-base">Open Store order</span>
          <span className="mt-1 block text-xs font-normal opacity-90">
            완료 주문 목록 · Print delivery docket
          </span>
        </Link>
        <Link
          href="/admin/stock"
          className="flex-1 rounded-xl border-2 border-brand-orange bg-white px-6 py-4 text-center text-sm font-semibold text-brand-navy transition hover:bg-brand-orange/10"
        >
          재고 확인 (Stock)
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-sm font-semibold text-brand-navy">공급처 시트가 필요할 때</h2>
        <p className="mt-2 text-sm text-slate-600">
          일일 발주 입력·출력은 Supplier orders에서 진행합니다.
        </p>
        <Link href="/admin/supplier-orders" className="mt-3 inline-block text-sm font-semibold text-brand-orange hover:underline">
          Supplier orders →
        </Link>
      </section>
    </div>
  );
}

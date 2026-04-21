import Link from "next/link";

export default function WarehouseManagerPage() {
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
          / Manager
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">창고 매니저</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          오늘의 입출고·공급처 라인·스토어 출고를 조율할 때 사용하는 화면입니다. 필요한 도구는 아래 링크에서 열 수 있습니다.
        </p>
      </header>

      <section className="rounded-xl border border-brand-orange/25 bg-brand-orange/5 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-navy">운영 체크리스트 (예시)</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
          <li>Supplier orders — 오늘 Perth 시트 기준 발주 라인 확인</li>
          <li>Store orders — 결제 완료 건 배송 준비·도크 출력</li>
          <li>Stock — 저재고 SKU 보충 여부</li>
          <li>Reports — 월말(25일) 공급처 집계가 필요할 때</li>
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/supplier-orders"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-orange/40"
        >
          <h3 className="font-semibold text-brand-navy">Supplier orders</h3>
          <p className="mt-1 text-sm text-slate-600">일일 공급처 시트 · Customer order ID 연동</p>
        </Link>
        <Link
          href="/admin/store-orders"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-orange/40"
        >
          <h3 className="font-semibold text-brand-navy">Store orders</h3>
          <p className="mt-1 text-sm text-slate-600">고객 주문 · 배송 도크</p>
        </Link>
        <Link
          href="/admin/stock"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-orange/40"
        >
          <h3 className="font-semibold text-brand-navy">Stock</h3>
          <p className="mt-1 text-sm text-slate-600">전 SKU 재고 수량</p>
        </Link>
        <Link
          href="/admin/reports"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-orange/40"
        >
          <h3 className="font-semibold text-brand-navy">Reports</h3>
          <p className="mt-1 text-sm text-slate-600">기간·공급처 요약</p>
        </Link>
      </section>
    </div>
  );
}

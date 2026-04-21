import Link from "next/link";

export default function WarehouseOverviewPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Warehouse
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">창고 (Warehouse)</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          매니저·작업자용 작업 허브입니다. <strong>Admin</strong> 계정(동일 비밀번호 로그인)으로 접근하며, 스토어 출고·재고·공급처 발주와 연결된 링크를 한곳에 모았습니다.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/warehouse/manager"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-orange/40 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-brand-navy">매니저 · Manager</h2>
          <p className="mt-2 text-sm text-slate-600">
            일일 우선순위, 입출고 조율, 공급처 일정 확인. Supplier / Store 주문과 보고서로 이동합니다.
          </p>
          <p className="mt-4 text-sm font-semibold text-brand-orange">열기 →</p>
        </Link>
        <Link
          href="/admin/warehouse/worker"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-orange/40 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-brand-navy">작업자 · Worker</h2>
          <p className="mt-2 text-sm text-slate-600">
            피킹·패킹·배송 준비. 스토어 주문·배송 도크와 재고 수량 확인으로 바로 연결합니다.
          </p>
          <p className="mt-4 text-sm font-semibold text-brand-orange">열기 →</p>
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-navy">바로 가기 · Quick links</h2>
        <ul className="mt-4 grid gap-2 text-sm font-semibold text-brand-orange sm:grid-cols-2">
          <li>
            <Link href="/admin/store-orders" className="hover:underline">
              스토어 주문 &amp; 배송 도크 →
            </Link>
          </li>
          <li>
            <Link href="/admin/stock" className="hover:underline">
              재고 (Stock) →
            </Link>
          </li>
          <li>
            <Link href="/admin/supplier-orders" className="hover:underline">
              공급처 일일 발주 (Supplier orders) →
            </Link>
          </li>
          <li>
            <Link href="/admin/reports" className="hover:underline">
              리포트 (Reports) →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

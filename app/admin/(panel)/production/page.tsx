import Link from "next/link";

import { StoreOrderBarcode } from "@/app/components/store-order-barcode";
import { formatPerthDateTimeShort } from "@/lib/perth-calendar";
import { storeOrderScanPayloadFromId } from "@/lib/store-order-scan-code";

import { listClickUpProductionQueue, type ClickUpProductionQueueRowDto } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminProductionPage() {
  let rows: ClickUpProductionQueueRowDto[] = [];
  let loadError: string | null = null;

  try {
    const res = await listClickUpProductionQueue();
    if (!res.ok) {
      loadError = res.error;
    } else {
      rows = res.rows;
    }
  } catch {
    loadError = "Supabase is not configured or the production queue table is missing. Run migrations.";
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin</p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Production</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          이 목록과 생산 팩은{" "}
          <Link href="/admin/click-up-sheet" className="font-semibold text-brand-orange hover:underline">
            Click up sheet
          </Link>
          에서 <strong>Move to Production</strong>을 눌렀을 때만 생깁니다. 새 스토어 주문만으로는 여기에 나타나지
          않습니다. 행을 열어 로고·자수/프린트 파일을 붙이고 생산 팩을 인쇄할 수 있습니다.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>{loadError}</p>
          <p className="mt-2 text-xs text-amber-900/90">
            테이블이 없다면 마이그레이션{" "}
            <span className="font-mono">20260448_click_up_production_queue.sql</span> 또는 SQL Editor 패치를 실행하세요.
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[900px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Order</th>
              <th className="min-w-[9rem] px-4 py-3">Order barcode</th>
              <th className="px-4 py-3">Perth sheet date</th>
              <th className="px-4 py-3">Pack started</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loadError ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  아직 생산 팩을 연 주문이 없습니다. Click up sheet에서 Order ID를 맞춘 뒤{" "}
                  <strong>Move to Production</strong>을 누르면 여기에 나타납니다.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.queueId} className="border-b border-slate-100 align-top">
                <td className="px-4 py-3">
                  <p className="font-mono font-semibold text-brand-navy">{r.orderNumber}</p>
                </td>
                <td className="px-4 py-3">
                  {r.storeOrderResolved ? (
                    <StoreOrderBarcode
                      value={storeOrderScanPayloadFromId(r.storeOrderId)}
                      compact
                      showLabel={false}
                      className="max-w-[10.5rem]"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-slate-800">{r.listDate || "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {formatPerthDateTimeShort(r.movedAt)}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.customerName}</p>
                  <p className="text-xs text-slate-600">{r.customerEmail}</p>
                </td>
                <td className="px-4 py-3 capitalize">{r.status}</td>
                <td className="px-4 py-3">
                  {r.storeOrderResolved ? (
                    <Link
                      href={`/admin/production/${r.storeOrderId}`}
                      className="inline-flex rounded-xl bg-brand-orange px-4 py-2 text-xs font-semibold text-brand-navy transition hover:brightness-95"
                    >
                      Open production pack →
                    </Link>
                  ) : (
                    <span className="text-xs text-amber-800" title="store_orders row missing for queue store_order_id">
                      Unlinked queue row
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

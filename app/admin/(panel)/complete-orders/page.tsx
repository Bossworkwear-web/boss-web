import Link from "next/link";

import { StoreOrderBarcode } from "@/app/components/store-order-barcode";
import { completeOrderDocumentsHref } from "@/lib/complete-order-documents-href";
import { storeOrderScanPayloadFromId } from "@/lib/store-order-scan-code";

import { listClickUpCompleteOrdersQueue, type ClickUpCompleteOrdersQueueRowDto } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminCompleteOrdersPage() {
  let rows: ClickUpCompleteOrdersQueueRowDto[] = [];
  let loadError: string | null = null;
  try {
    const res = await listClickUpCompleteOrdersQueue();
    if (!res.ok) {
      loadError = res.error;
    } else {
      rows = res.rows;
    }
  } catch {
    loadError =
      "Supabase is not configured or the Complete Orders queue table is missing. Run migrations.";
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin</p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Complete Orders</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          <Link href="/admin/dispatch" className="font-semibold text-brand-orange hover:underline">
            Dispatch
          </Link>{" "}
          에서 <strong>Complete</strong>를 누르면 아래 목록으로 옮겨집니다. 출고·패킹을 마친 주문을 여기서 확인합니다.
        </p>
      </header>

      <section
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        aria-labelledby="complete-orders-queue-heading"
      >
        <h2 id="complete-orders-queue-heading" className="text-lg font-semibold text-brand-navy">
          Complete orders list
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          같은 주문을 Dispatch에서 다시 <strong>Complete</strong>하면 이 목록의 순서·시각만 갱신됩니다.
        </p>
        {loadError ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>{loadError}</p>
            <p className="mt-2 text-xs text-amber-900/90">
              테이블이 없다면 마이그레이션{" "}
              <span className="font-mono">20260451_click_up_complete_orders_queue.sql</span> 또는 SQL Editor 패치{" "}
              <span className="font-mono">patch_click_up_complete_orders_queue.sql</span>을 실행하세요.
            </p>
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-[820px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">Order</th>
                <th className="min-w-[9rem] px-2 py-3">Order barcode</th>
                <th className="px-4 py-3">Perth sheet date</th>
                <th className="px-4 py-3">Completed at</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="min-w-[8rem] px-4 py-3">Documents</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loadError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    아직 목록이 없습니다.{" "}
                    <Link href="/admin/dispatch" className="font-semibold text-brand-orange hover:underline">
                      Dispatch
                    </Link>
                    에서 주문을 <strong>Complete</strong>하면 여기에 나타납니다.
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.queueId} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold text-brand-navy">{r.orderNumber}</p>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <StoreOrderBarcode
                      value={storeOrderScanPayloadFromId(r.storeOrderId)}
                      compact
                      showLabel={false}
                      className="max-w-[10.5rem]"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-800">{r.listDate || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(r.completedAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.customerName}</p>
                    <p className="text-xs text-slate-600">{r.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{r.status}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={completeOrderDocumentsHref(r.storeOrderId, r.listDate, r.orderNumber)}
                      className="inline-flex justify-center rounded-xl bg-brand-orange px-3 py-2 text-xs font-semibold text-brand-navy transition hover:brightness-95"
                    >
                      VIEW
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">관련 메뉴</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">
          <li>
            <Link href="/admin/dispatch" className="font-semibold text-brand-orange hover:underline">
              Dispatch
            </Link>
          </li>
          <li>
            <Link href="/admin/store-orders" className="font-semibold text-brand-orange hover:underline">
              Store orders
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

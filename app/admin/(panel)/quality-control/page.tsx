import Link from "next/link";

import { StoreOrderBarcode } from "@/app/components/store-order-barcode";
import { qualityCheckSheetHref } from "@/lib/quality-check-sheet-href";
import { storeOrderScanPayloadFromId } from "@/lib/store-order-scan-code";

import { listClickUpQualityCheckQueue, type ClickUpQcQueueRowDto } from "./actions";
import { OpenQualityCheckSheetForm } from "./open-quality-check-sheet-form";

export const dynamic = "force-dynamic";

export default async function AdminQualityControlPage() {
  let qcRows: ClickUpQcQueueRowDto[] = [];
  let qcLoadError: string | null = null;
  try {
    const res = await listClickUpQualityCheckQueue();
    if (!res.ok) {
      qcLoadError = res.error;
    } else {
      qcRows = res.rows;
    }
  } catch {
    qcLoadError = "Supabase is not configured or the QC queue table is missing. Run migrations.";
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin</p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Quality Control</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          출고 전 품질 점검과 기록을 모아 둔 구역입니다.{" "}
          <Link href="/admin/production" className="font-semibold text-brand-orange hover:underline">
            Production pack
          </Link>
          에서 <strong>Move to QC</strong>를 누르면 아래 목록에 행이 생기며, 각 행에서 Quality Check sheet를 열 수 있습니다.
        </p>
      </header>

      <section
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        aria-labelledby="qc-queue-heading"
      >
        <h2 id="qc-queue-heading" className="text-lg font-semibold text-brand-navy">
          Quality Check sheet list
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Production pack에서 <strong>Move to QC</strong>로 넘긴 주문만 표시됩니다. 같은 주문에서{" "}
          <strong>Move to QC</strong>를 다시 누르면 목록 순서만 갱신됩니다.
        </p>
        {qcLoadError ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>{qcLoadError}</p>
            <p className="mt-2 text-xs text-amber-900/90">
              테이블이 없다면 마이그레이션{" "}
              <span className="font-mono">20260449_click_up_qc_queue.sql</span> 또는 SQL Editor 패치{" "}
              <span className="font-mono">patch_click_up_qc_queue.sql</span>을 실행하세요.
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
                <th className="px-4 py-3">Sent to QC</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-44"></th>
              </tr>
            </thead>
            <tbody>
              {qcRows.length === 0 && !qcLoadError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    아직 목록이 없습니다.{" "}
                    <Link href="/admin/production" className="font-semibold text-brand-orange hover:underline">
                      Production
                    </Link>
                    에서 생산 팩을 연 뒤 <strong>Move to QC</strong>를 누르면 여기에 나타납니다.
                  </td>
                </tr>
              ) : null}
              {qcRows.map((r) => (
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
                    {new Date(r.movedAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.customerName}</p>
                    <p className="text-xs text-slate-600">{r.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{r.status}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={qualityCheckSheetHref(r.listDate, r.orderNumber)}
                      className="inline-flex rounded-xl bg-brand-orange px-4 py-2 text-xs font-semibold text-brand-navy transition hover:brightness-95"
                    >
                      Open Quality Check sheet →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="qc-sheet-heading">
        <h2 id="qc-sheet-heading" className="text-lg font-semibold text-brand-navy">
          Quality Check sheet (manual open)
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          체크리스트, 메모, 검수 기록은 브라우저 로컬에 저장됩니다. 워크시트 날짜와 주문 ID를 넣으면 해당 주문에 맞춘 시트로
          이동합니다.
        </p>
        <OpenQualityCheckSheetForm />
        <p className="mt-4 border-t border-slate-100 pt-4 text-sm">
          <Link href="/admin/quality-check-sheet" className="font-semibold text-brand-orange hover:underline">
            Quality Check sheet로 바로 가기 (쿼리 없음)
          </Link>
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="qc-workflows-heading">
        <h2 id="qc-workflows-heading" className="text-lg font-semibold text-brand-navy">
          관련 업무
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">
          <li>
            <Link href="/admin/work-process" className="font-semibold text-brand-orange hover:underline">
              Click Up (Work process)
            </Link>
            — 각 행에서 Quality Check sheet로 바로 연결됩니다.
          </li>
          <li>
            <Link href="/admin/complete-statement" className="font-semibold text-brand-orange hover:underline">
              Complete statement
            </Link>
            — 완료 시트 맥락에서 품질 시트 링크를 사용할 수 있습니다.
          </li>
          <li>
            <Link href="/admin/production" className="font-semibold text-brand-orange hover:underline">
              Production
            </Link>
            — 생산 팩·자산과 함께 목업을 확인한 뒤 <strong>Move to QC</strong>로 이 페이지 목록에 추가할 수 있습니다.
          </li>
        </ul>
      </section>
    </div>
  );
}

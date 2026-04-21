import Link from "next/link";

import { qualityCheckSheetHref } from "@/lib/quality-check-sheet-href";
import { storeOrderScanPayloadFromId } from "@/lib/store-order-scan-code";

import { completeDispatchQueueRow, listClickUpDispatchQueue, type ClickUpDispatchQueueRowDto } from "./actions";
import { DispatchExpandableBarcode } from "./dispatch-expandable-barcode";
import { PrintDocketButton } from "./print-docket-button";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ complete_error?: string }> };

export default async function AdminDispatchPage({ searchParams }: PageProps) {
  const q = searchParams ? await searchParams : {};
  const completeErrorRaw = (q.complete_error ?? "").trim();
  let completeError: string | null = null;
  if (completeErrorRaw === "invalid_queue") {
    completeError = "유효하지 않은 큐 항목입니다.";
  } else if (completeErrorRaw) {
    try {
      completeError = decodeURIComponent(completeErrorRaw.replace(/\+/g, " "));
    } catch {
      completeError = completeErrorRaw;
    }
  }

  let rows: ClickUpDispatchQueueRowDto[] = [];
  let loadError: string | null = null;
  try {
    const res = await listClickUpDispatchQueue();
    if (!res.ok) {
      loadError = res.error;
    } else {
      rows = res.rows;
    }
  } catch {
    loadError = "Supabase is not configured or the dispatch queue table is missing. Run migrations.";
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin</p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Dispatch</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          <Link href="/admin/quality-check-sheet" className="font-semibold text-brand-orange hover:underline">
            Quality Check sheet
          </Link>
          에서 <strong>Move to Dispatch</strong>를 누르면 아래 목록에 행이 생깁니다. 배송·출고 작업을 이 주문 단위로
          이어가면 됩니다.
        </p>
      </header>

      <section
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        aria-labelledby="dispatch-queue-heading"
      >
        <h2 id="dispatch-queue-heading" className="text-lg font-semibold text-brand-navy">
          Dispatch queue
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          같은 주문에서 <strong>Move to Dispatch</strong>를 다시 누르면 목록 순서만 갱신됩니다. 출고가 끝나면{" "}
          <strong>Complete</strong>를 누르면 이 행은 Dispatch 목록에서 사라지고{" "}
          <Link href="/admin/complete-orders" className="font-semibold text-brand-orange hover:underline">
            Complete Orders
          </Link>{" "}
          로 이동하며, 화면은 Complete Orders로 열립니다.
        </p>
        {completeError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
            <p>{completeError}</p>
          </div>
        ) : null}
        {loadError ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>{loadError}</p>
            <p className="mt-2 text-xs text-amber-900/90">
              SQL Editor에서 한 번에:{" "}
              <span className="font-mono">supabase/sql-editor/patch_click_up_dispatch_queue.sql</span> 실행 후 Settings →
              API → Reload schema. 또는 마이그레이션{" "}
              <span className="font-mono">20260450_click_up_delivery_queue.sql</span> 다음{" "}
              <span className="font-mono">20260455_rename_click_up_delivery_queue_to_dispatch.sql</span>, 또는{" "}
              <span className="font-mono">patch_click_up_delivery_queue.sql</span> 후 이름 변경 마이그레이션을 실행하세요.
            </p>
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-[900px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">Order</th>
                <th className="min-w-[9rem] px-2 py-3">Order barcode</th>
                <th className="px-4 py-3">Perth sheet date</th>
                <th className="px-4 py-3">Sent to dispatch</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="min-w-[22.5rem] px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loadError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    아직 목록이 없습니다.{" "}
                    <Link href="/admin/quality-control" className="font-semibold text-brand-orange hover:underline">
                      Quality Control
                    </Link>
                    에서 Quality Check sheet를 연 뒤 <strong>Move to Dispatch</strong>를 누르면 여기에 나타납니다.
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.queueId} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold text-brand-navy">{r.orderNumber}</p>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <DispatchExpandableBarcode
                      value={storeOrderScanPayloadFromId(r.storeOrderId)}
                      orderNumber={r.orderNumber}
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
                    <div className="mx-auto flex w-4/5 min-w-0 max-w-full flex-nowrap items-stretch gap-2">
                      <Link
                        href={qualityCheckSheetHref(r.listDate, r.orderNumber)}
                        className="inline-flex min-h-[2.25rem] min-w-0 flex-1 basis-0 items-center justify-center rounded-xl bg-slate-100 px-2 py-2 text-center text-xs font-semibold leading-tight text-brand-navy transition hover:bg-slate-200"
                      >
                        Quality sheet →
                      </Link>
                      <PrintDocketButton
                        storeOrderId={r.storeOrderId}
                        className="inline-flex min-h-[2.25rem] min-w-0 flex-1 basis-0 cursor-pointer items-center justify-center rounded-xl bg-brand-orange px-2 py-2 text-center text-xs font-semibold leading-tight text-brand-navy transition hover:brightness-95"
                      />
                      <form
                        action={completeDispatchQueueRow}
                        className="flex min-w-0 flex-1 basis-0 flex-col justify-center"
                      >
                        <input type="hidden" name="queue_id" value={r.queueId} />
                        <button
                          type="submit"
                          className="inline-flex min-h-[2.25rem] w-full cursor-pointer items-center justify-center rounded-xl bg-emerald-700 px-2 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
                        >
                          Complete
                        </button>
                      </form>
                    </div>
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
            <Link href="/admin/store-orders" className="font-semibold text-brand-orange hover:underline">
              Store orders
            </Link>
            — 주문 상태·배송 정보 확인
          </li>
          <li>
            <Link href="/admin/warehouse" className="font-semibold text-brand-orange hover:underline">
              Warehouse
            </Link>
            — 창고·피킹 흐름
          </li>
        </ul>
      </section>
    </div>
  );
}

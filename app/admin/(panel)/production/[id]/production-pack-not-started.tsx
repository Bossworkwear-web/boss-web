import Link from "next/link";

export function ProductionPackNotStarted({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-amber-200 bg-amber-50/90 p-6 text-sm text-amber-950 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-900/80">Admin / Production</p>
      <h1 className="text-xl font-semibold text-brand-navy">Production pack not started</h1>
      <p>
        주문 <span className="font-mono font-semibold text-brand-navy">{orderNumber}</span>은(는) 아직 Click up sheet에서{" "}
        <strong>Move to Production</strong>으로 보내지 않았습니다. 생산 팩 화면·파일 업로드는 그 단계 이후에만
        사용할 수 있습니다.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href="/admin/click-up-sheet"
          className="inline-flex justify-center rounded-xl bg-brand-orange px-4 py-2.5 text-center text-xs font-semibold text-brand-navy transition hover:brightness-95"
        >
          Open Click up sheet
        </Link>
        <Link
          href="/admin/production"
          className="inline-flex justify-center rounded-xl border border-brand-navy/30 bg-white px-4 py-2.5 text-center text-xs font-semibold text-brand-navy transition hover:bg-slate-50"
        >
          Back to Production
        </Link>
      </div>
      <p className="text-xs text-amber-900/85">
        이미 옮겼는데도 이 메시지가 보이면 Supabase에{" "}
        <span className="font-mono">20260448_click_up_production_queue.sql</span> 마이그레이션을 적용했는지 확인하세요.
      </p>
    </div>
  );
}

import Link from "next/link";

import { createSupabaseAdminClient } from "@/lib/supabase";

import { ClearanceStockTable, type ClearanceStockRow } from "./clearance-stock-table";

export const dynamic = "force-dynamic";

type Search = {
  created?: string;
  updated?: string;
  deleted?: string;
  error?: string;
};

export default async function AdminClearanceStockPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const q = await searchParams;
  let rows: ClearanceStockRow[] = [];
  let loadError: string | null = null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("clearance_stock_items")
      .select(
        "id, title, subtitle, description, price_label, quantity, product_slug, image_url, sort_order, is_published, created_at, updated_at",
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      loadError = error.message.includes("clearance_stock_items")
        ? `${error.message} — Supabase에 마이그레이션 supabase/migrations/20260460_clearance_stock_items.sql 을 적용한 뒤 API 스키마를 새로고침하세요.`
        : error.message;
    } else {
      rows = (data ?? []) as ClearanceStockRow[];
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load clearance stock.";
  }

  let banner: { kind: "ok" | "err"; text: string } | null = null;
  if (q.created === "1") banner = { kind: "ok", text: "항목을 추가했습니다." };
  else if (q.updated === "1") banner = { kind: "ok", text: "저장했습니다." };
  else if (q.deleted === "1") banner = { kind: "ok", text: "삭제했습니다." };
  else if (q.error === "missing_title") banner = { kind: "err", text: "제목(title)은 필수입니다." };
  else if (q.error === "invalid_row") banner = { kind: "err", text: "잘못된 요청입니다." };
  else if (q.error) {
    try {
      banner = { kind: "err", text: decodeURIComponent(q.error.replace(/\+/g, " ")) };
    } catch {
      banner = { kind: "err", text: q.error };
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Clearance Stock
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Clearance Stock</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          카탈로그와 별도로, 이벤트·클리어런스 전용으로 손으로 적는 라인입니다. 나중에 스토어 Clearance 페이지에서 이
          데이터를 읽어오면 됩니다.
        </p>
      </header>

      {banner ? (
        <div
          className={
            banner.kind === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loadError}
        </div>
      ) : (
        <ClearanceStockTable rows={rows} />
      )}
    </div>
  );
}

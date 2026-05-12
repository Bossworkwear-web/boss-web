import Link from "next/link";
import { cookies } from "next/headers";

import { ADMIN_USER_COOKIE } from "@/lib/admin-constants";
import { createSupabaseAdminClient } from "@/lib/supabase";

import { AccessControlTable, type AdminAccessUserRow } from "./access-control-table";

export const dynamic = "force-dynamic";

type Search = {
  created?: string;
  updated?: string;
  deleted?: string;
  password_cleared?: string;
  error?: string;
};

export default async function AdminAccessControlPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;

  const cookieStore = await cookies();
  const currentUser = (cookieStore.get(ADMIN_USER_COOKIE)?.value ?? "").trim();

  let rows: AdminAccessUserRow[] = [];
  let loadError: string | null = null;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("admin_access_users")
      .select("id, identifier, role, is_active, created_at, password_hash")
      .order("created_at", { ascending: false });

    if (error) {
      loadError = error.message.includes("admin_access_users") || error.message.includes("password_hash")
        ? `${error.message} — Supabase에 마이그레이션 supabase/migrations/20260461_admin_access_control.sql 및 20260513_admin_access_users_password_hash.sql 을 적용한 뒤 API 스키마를 새로고침하세요.`
        : error.message;
    } else {
      rows = (data ?? []).map((row) => ({
        id: row.id,
        identifier: row.identifier,
        role: row.role,
        is_active: row.is_active,
        created_at: row.created_at,
        has_individual_password: Boolean(row.password_hash?.trim()),
      }));
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load access control list.";
  }

  let banner: { kind: "ok" | "err"; text: string } | null = null;
  if (q.created === "1") banner = { kind: "ok", text: "추가했습니다." };
  else if (q.updated === "1") banner = { kind: "ok", text: "저장했습니다." };
  else if (q.deleted === "1") banner = { kind: "ok", text: "삭제했습니다." };
  else if (q.password_cleared === "1") banner = { kind: "ok", text: "개별 비밀번호를 제거했습니다. 이제 공유 비밀번호로 로그인합니다." };
  else if (q.error === "missing_identifier") banner = { kind: "err", text: "Identifier는 필수입니다." };
  else if (q.error === "invalid_row") banner = { kind: "err", text: "잘못된 요청입니다." };
  else if (q.error === "password_incomplete") {
    banner = { kind: "err", text: "비밀번호를 바꾸려면 새 비밀번호와 확인을 모두 입력하세요." };
  } else if (q.error === "password_mismatch") {
    banner = { kind: "err", text: "새 비밀번호와 확인이 일치하지 않습니다." };
  } else if (q.error === "password_short") {
    banner = { kind: "err", text: "비밀번호는 최소 8자 이상이어야 합니다." };
  } else if (q.error) {
    try {
      banner = { kind: "err", text: decodeURIComponent(q.error.replace(/\+/g, " ")) };
    } catch {
      banner = { kind: "err", text: q.error };
    }
  }

  const activeCount = rows.filter((r) => r.is_active).length;
  const enforcing = activeCount > 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          /{" "}
          <Link href="/admin/accounting" className="text-brand-orange hover:underline">
            Accounting
          </Link>{" "}
          / Access control
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Access control</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Admin 접속을 허용된 사용자(식별자)로 제한합니다.{" "}
          <strong>Active 사용자</strong>가 1명이라도 있으면 접근 제어가 켜집니다.
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

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</dt>
            <dd className="mt-1 font-semibold text-brand-navy">{enforcing ? "ENFORCING" : "DISABLED (safe)"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active users</dt>
            <dd className="mt-1 font-semibold text-brand-navy">{String(activeCount)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current login identifier</dt>
            <dd className="mt-1 font-mono text-brand-navy">{currentUser || "—"}</dd>
          </div>
        </dl>
        {enforcing ? (
          <p className="mt-4 text-sm text-slate-600">
            현재 로그인 identifier가 Active 목록에 없으면, 다음 요청부터 <strong>Unauthorized</strong>가 됩니다.
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            아직 Active 사용자가 없어서 접근 제어가 꺼져 있습니다. (잠금 방지)
          </p>
        )}
      </div>

      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadError}</div>
      ) : (
        <AccessControlTable rows={rows} />
      )}
    </div>
  );
}


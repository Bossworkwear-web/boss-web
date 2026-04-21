"use client";

import { createAdminAccessUser, deleteAdminAccessUser, updateAdminAccessUser } from "./actions";

export type AdminAccessUserRow = {
  id: string;
  identifier: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

const inputClass =
  "mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

function RoleSelect({ name, defaultValue }: { name: string; defaultValue: string }) {
  return (
    <select name={name} defaultValue={defaultValue} className={inputClass}>
      <option value="owner">Owner</option>
      <option value="admin">Admin</option>
      <option value="manager">Manager</option>
      <option value="office_team">Office Team</option>
      <option value="warehouse_team">Warehouse Team</option>
    </select>
  );
}

function ActiveSelect({ name, defaultValue }: { name: string; defaultValue: boolean }) {
  return (
    <select name={name} defaultValue={defaultValue ? "true" : "false"} className={inputClass}>
      <option value="true">Active</option>
      <option value="false">Disabled</option>
    </select>
  );
}

export function AccessControlTable({ rows }: { rows: AdminAccessUserRow[] }) {
  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Add allowed user</h2>
        <p className="mt-2 text-sm text-slate-600">
          <strong>Active 사용자</strong>가 1명이라도 있으면, Admin 접속은 로그인 화면의 <strong>Email / name</strong> 값이 이
          리스트에 포함된 경우에만 허용됩니다.
        </p>
        <form action={createAdminAccessUser} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="new-identifier">
              Identifier (email/name) <span className="text-red-600">*</span>
            </label>
            <input
              id="new-identifier"
              name="identifier"
              required
              className={inputClass}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-role">
              Role
            </label>
            <RoleSelect name="role" defaultValue="admin" />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-active">
              Status
            </label>
            <ActiveSelect name="is_active" defaultValue />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95"
            >
              Add
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Allowed users ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            아직 없습니다. (이 상태에서는 접근 제어가 <strong>비활성화</strong>입니다 — 잠금 방지)
          </p>
        ) : (
          <ul className="mt-6 space-y-6">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <form className="space-y-3">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      ID <span className="font-mono">{r.id}</span>
                      <span className="mx-2">·</span>
                      Created{" "}
                      {new Date(r.created_at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        formAction={updateAdminAccessUser}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                      >
                        Save
                      </button>
                      <button
                        type="submit"
                        formAction={deleteAdminAccessUser}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Identifier</label>
                      <input name="identifier" defaultValue={r.identifier} required className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Role</label>
                      <RoleSelect name="role" defaultValue={r.role} />
                    </div>
                    <div>
                      <label className={labelClass}>Status</label>
                      <ActiveSelect name="is_active" defaultValue={r.is_active} />
                    </div>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}


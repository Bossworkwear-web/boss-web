"use client";

import Link from "next/link";

import { formatPerthDateTime } from "@/lib/perth-calendar";

import { DeleteQuoteListButton } from "./delete-quote-list-button";

export type CustomerQuoteListRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  pipeline_stage: string | null;
  created_at: string;
};

export function CustomerQuoteList({ quotes }: { quotes: CustomerQuoteListRow[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Quote list</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            CRM <span className="font-mono">quote_requests</span> 최신 순입니다.{" "}
            <strong>Open</strong>으로 견적 가격표를 수정·저장하세요.
          </p>
        </div>
        <Link
          href="/admin/customer-quote?create=1"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-orange px-5 py-2.5 text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95"
        >
          Create Quote
        </Link>
      </div>

      {quotes.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600">
          등록된 견적이 없습니다. <strong>Create Quote</strong>로 새 견적을 시작하세요.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-[720px] w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Stage</th>
                <th className="whitespace-nowrap px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map((row) => (
                <tr key={row.id} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-brand-navy">{row.company_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-800">{row.contact_name || "—"}</td>
                  <td className="max-w-[14rem] truncate px-4 py-3 font-mono text-xs text-slate-700" title={row.email}>
                    {row.email || "—"}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-700">{row.pipeline_stage?.trim() || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 tabular-nums">
                    {row.created_at ? formatPerthDateTime(row.created_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/admin/customer-quote?quote_id=${encodeURIComponent(row.id)}`}
                        className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-brand-navy hover:bg-slate-200"
                      >
                        Open
                      </Link>
                      <DeleteQuoteListButton quoteId={row.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

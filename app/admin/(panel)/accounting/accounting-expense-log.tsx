"use client";

import { useMemo, useState } from "react";

import type { AccountingExpenseRow } from "@/app/admin/(panel)/accounting/accounting-expense-types";
import { ACCOUNTING_EXPENSE_RECEIPTS_BUCKET } from "@/lib/accounting-expense-receipts";
import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";

const FILTER_ALL = "";
const FILTER_NONE = "__none__";

const selectClass =
  "min-w-[12rem] max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";

function formatRowDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Australia/Perth",
    });
  } catch {
    return iso;
  }
}

type Props = {
  rows: AccountingExpenseRow[];
  /** Server action from parent (do not import `"use server"` module in this client file). */
  deleteExpense: (formData: FormData) => Promise<void>;
};

export function AccountingExpenseLog({ rows, deleteExpense }: Props) {
  const [categoryFilter, setCategoryFilter] = useState(FILTER_ALL);

  const { options, hasUncategorized } = useMemo(() => {
    const seen = new Set<string>();
    let unc = false;
    for (const r of rows) {
      const c = r.category.trim();
      if (!c) unc = true;
      else seen.add(c);
    }
    const sorted = [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return { options: sorted, hasUncategorized: unc };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (categoryFilter === FILTER_ALL) return rows;
    if (categoryFilter === FILTER_NONE) return rows.filter((r) => !r.category.trim());
    return rows.filter((r) => r.category.trim() === categoryFilter);
  }, [rows, categoryFilter]);

  const totalCents = filteredRows.reduce((s, r) => s + Math.max(0, r.amount_cents), 0);

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Expense log</h2>
          <p className="mt-1 text-sm text-slate-600">
            Most recent 200 entries by expense date. Pick a category to narrow the list.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="expense-log-category" className="sr-only">
              Category
            </label>
            <select
              id="expense-log-category"
              className={selectClass}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value={FILTER_ALL}>All categories</option>
              {hasUncategorized ? <option value={FILTER_NONE}>(No category)</option> : null}
              {options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-600 sm:pb-0.5">
            Total shown:{" "}
            <span className="font-semibold tabular-nums text-brand-navy">{formatMoneyFromCents(totalCents, "AUD")}</span>
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No expenses recorded yet.</p>
      ) : filteredRows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No expenses in this category.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Receipt</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Vendor</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3 text-right">Amount</th>
                <th className="py-2 pr-3">Recorded</th>
                <th className="py-2 w-[1%] whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const receiptUrl = r.receipt_storage_path
                  ? publicStorageObjectUrl(ACCOUNTING_EXPENSE_RECEIPTS_BUCKET, r.receipt_storage_path)
                  : "";
                return (
                  <tr key={r.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2 pr-3">
                      {receiptUrl ? (
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block rounded border border-slate-200 bg-slate-50 p-0.5 shadow-sm transition hover:border-brand-orange/50"
                          aria-label="Open receipt image"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- small table thumb; external public URL */}
                          <img src={receiptUrl} alt="" className="h-12 w-12 rounded object-cover" width={48} height={48} />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-700">{r.expense_date}</td>
                    <td className="py-2 pr-3 text-slate-600">{r.category || "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{r.vendor || "—"}</td>
                    <td className="py-2 pr-3 text-slate-800">
                      <span className="font-medium">{r.description}</span>
                      {r.notes ? <p className="mt-0.5 text-xs text-slate-500">{r.notes}</p> : null}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums text-brand-navy">
                      {formatMoneyFromCents(r.amount_cents, r.currency || "AUD")}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{formatRowDate(r.created_at)}</td>
                    <td className="py-2">
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

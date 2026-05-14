import { deleteAccountingExpense } from "@/app/admin/(panel)/accounting/actions";
import { AccountingExpenseLog } from "@/app/admin/(panel)/accounting/accounting-expense-log";
import { AccountingExpenseRecordForm } from "@/app/admin/(panel)/accounting/accounting-expense-record-form";
import type { AccountingExpenseRow } from "@/app/admin/(panel)/accounting/accounting-expense-types";

export type { AccountingExpenseRow } from "@/app/admin/(panel)/accounting/accounting-expense-types";

type Props = {
  rows: AccountingExpenseRow[];
  defaultExpenseDate: string;
};

export function AccountingExpensesSection({ rows, defaultExpenseDate }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
        <h2 className="text-lg font-semibold text-brand-navy">Record expense</h2>
        <p className="mt-1 text-sm text-slate-600">
          Amounts are stored in <strong>AUD</strong> (cents internally). Use the date the cost applies to, not necessarily
          today. Drag a receipt onto the drop zone (or click to browse); it is saved with the expense when you press{" "}
          <strong>Save expense</strong>.
        </p>
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <strong>Receipt retention</strong> (Perth <code className="rounded bg-white px-1">expense_date</code>): category{" "}
          <strong>Equipment</strong> (case-insensitive) keeps images <strong>5 years</strong>; all other categories{" "}
          <strong>1 year</strong>. After that, the file is removed from storage and the receipt link is cleared — the expense
          line stays. Schedule <code className="rounded bg-white px-1">GET /api/cron/accounting-receipt-retention</code> with{" "}
          <code className="rounded bg-white px-1">Authorization: Bearer CRON_SECRET</code> (weekly cron is in{" "}
          <code className="rounded bg-white px-1">vercel.json</code>).
        </p>
        <AccountingExpenseRecordForm defaultExpenseDate={defaultExpenseDate} />
      </section>

      <AccountingExpenseLog rows={rows} deleteExpense={deleteAccountingExpense} />
    </div>
  );
}

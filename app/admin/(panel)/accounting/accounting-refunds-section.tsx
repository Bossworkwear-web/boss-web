import {
  createAccountingRefund,
  deleteAccountingRefund,
  updateAccountingRefund,
} from "@/app/admin/(panel)/accounting/refund-actions";
import { formatMoneyFromCents } from "@/lib/store-order-utils";

export type AccountingRefundRow = {
  id: string;
  issue_date: string;
  order_id: string;
  description: string;
  amount_cents: number;
  currency: string;
  date_refunded: string | null;
  xero_updated: boolean;
  created_at: string;
};

const inputClass =
  "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

type Props = {
  rows: AccountingRefundRow[];
  defaultIssueDate: string;
};

export function AccountingRefundsSection({ rows, defaultIssueDate }: Props) {
  const totalCents = rows.reduce((s, r) => s + Math.max(0, r.amount_cents), 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
      <h2 className="text-lg font-semibold text-brand-navy">Refunds</h2>
      <p className="mt-1 text-sm text-slate-600">
        Log refunds issued to customers. Amounts are <strong>AUD</strong> (positive number = refund value). Order ID
        can be the web <span className="font-mono">BOS_…</span> number or <span className="font-mono">store_orders.id</span>{" "}
        UUID. Tick <strong>Xero updated</strong> when the entry is reflected in Xero.
      </p>

      <form action={createAccountingRefund} className="mt-6 grid gap-4 border-b border-slate-200 pb-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="refund-issue-date">
            Issue date <span className="text-red-600">*</span>
          </label>
          <input
            id="refund-issue-date"
            name="issue_date"
            type="date"
            required
            defaultValue={defaultIssueDate}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="refund-order-id">
            Order ID
          </label>
          <input
            id="refund-order-id"
            name="order_id"
            className={`${inputClass} font-mono`}
            placeholder="BOS_… or UUID"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <label className={labelClass} htmlFor="refund-amount">
            Amount (AUD) <span className="text-red-600">*</span>
          </label>
          <input
            id="refund-amount"
            name="amount_aud"
            type="text"
            inputMode="decimal"
            required
            className={inputClass}
            placeholder="e.g. 89.00"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelClass} htmlFor="refund-description">
            Description <span className="text-red-600">*</span>
          </label>
          <input
            id="refund-description"
            name="description"
            required
            className={inputClass}
            placeholder="Reason / line reference"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="refund-date-refunded">
            Date refunded
          </label>
          <input id="refund-date-refunded" name="date_refunded" type="date" className={inputClass} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="xero_updated" className="h-4 w-4 rounded border-slate-300 text-brand-orange" />
            Xero updated
          </label>
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            Add refund
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate-600">Most recent 200 refunds by issue date.</p>
        <p className="text-sm text-slate-600">
          Total shown:{" "}
          <span className="font-semibold tabular-nums text-brand-navy">{formatMoneyFromCents(totalCents, "AUD")}</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No refunds recorded yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4 lg:flex-row lg:items-end lg:justify-between"
            >
              <form action={updateAccountingRefund} className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <input type="hidden" name="id" value={r.id} />
                <div>
                  <label className={labelClass}>Issue date</label>
                  <input name="issue_date" type="date" required defaultValue={r.issue_date} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Order ID</label>
                  <input
                    name="order_id"
                    type="text"
                    defaultValue={r.order_id}
                    className={`${inputClass} font-mono text-xs`}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className={labelClass}>Description</label>
                  <input name="description" type="text" required defaultValue={r.description} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Amount (AUD)</label>
                  <input
                    name="amount_aud"
                    type="text"
                    inputMode="decimal"
                    required
                    defaultValue={(r.amount_cents / 100).toFixed(2)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Date refunded</label>
                  <input
                    name="date_refunded"
                    type="date"
                    defaultValue={r.date_refunded ?? ""}
                    className={inputClass}
                  />
                </div>
                <div className="flex items-end pb-2 lg:col-span-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="xero_updated"
                      defaultChecked={r.xero_updated}
                      className="h-4 w-4 rounded border-slate-300 text-brand-orange"
                    />
                    Xero updated
                  </label>
                </div>
                <div className="flex items-end sm:col-span-2 lg:col-span-6">
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-navy shadow-sm transition hover:bg-slate-50"
                  >
                    Save changes
                  </button>
                </div>
              </form>
              <form action={deleteAccountingRefund} className="shrink-0">
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                >
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

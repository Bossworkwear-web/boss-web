"use client";

import {
  createPromotionCode,
  markPromotionCodeSent,
  setPromotionCodeStatus,
  updatePromotionCode,
} from "./actions";

export type PromotionAdminRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed_aud";
  discount_value: number;
  min_subtotal_aud: number;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  max_redemptions_per_customer: number | null;
  status: "active" | "disabled" | "expired";
  sent_to_email: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

const inputClass =
  "mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDiscount(row: PromotionAdminRow): string {
  if (row.discount_type === "percent") {
    return `${row.discount_value}% off products`;
  }
  return `$${Number(row.discount_value).toFixed(2)} off products`;
}

function statusBadge(status: PromotionAdminRow["status"]) {
  const styles =
    status === "active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "disabled"
        ? "bg-slate-100 text-slate-700"
        : "bg-amber-100 text-amber-900";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${styles}`}>
      {status}
    </span>
  );
}

type Props = { rows: PromotionAdminRow[] };

export function PromotionAdminClient({ rows }: Props) {
  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Create promotion code</h2>
        <p className="mt-1 text-sm text-slate-600">
          Codes apply to the product subtotal at checkout (after volume discount). Customers enter the code on the
          payment page.
        </p>
        <form action={createPromotionCode} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="new-code">
              Code <span className="text-red-600">*</span>
            </label>
            <input
              id="new-code"
              name="code"
              required
              className={inputClass}
              placeholder="SUMMER20"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-discount-type">
              Discount type
            </label>
            <select id="new-discount-type" name="discount_type" defaultValue="percent" className={inputClass}>
              <option value="percent">Percent (%)</option>
              <option value="fixed_aud">Fixed amount (AUD)</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="new-discount-value">
              Discount value
            </label>
            <input
              id="new-discount-value"
              name="discount_value"
              type="number"
              min={0.01}
              step={0.01}
              required
              className={inputClass}
              placeholder="10 or 25.00"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-min-subtotal">
              Min product subtotal (AUD)
            </label>
            <input id="new-min-subtotal" name="min_subtotal_aud" type="number" min={0} step={0.01} defaultValue={0} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-starts">
              Valid from (optional)
            </label>
            <input id="new-starts" name="starts_at" type="datetime-local" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-ends">
              Valid until (optional)
            </label>
            <input id="new-ends" name="ends_at" type="datetime-local" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-max-total">
              Max total uses (blank = unlimited)
            </label>
            <input id="new-max-total" name="max_redemptions" type="number" min={1} step={1} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-max-customer">
              Max uses per customer
            </label>
            <input
              id="new-max-customer"
              name="max_redemptions_per_customer"
              type="number"
              min={1}
              step={1}
              defaultValue={1}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="new-description">
              Internal note (optional)
            </label>
            <input id="new-description" name="description" className={inputClass} placeholder="Campaign or customer group" />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-95"
            >
              Create code
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-navy">All codes ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-600">No promotion codes yet.</p>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-semibold text-brand-navy">{row.code}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{formatDiscount(row)}</p>
                  {row.description ? <p className="mt-1 text-xs text-slate-500">{row.description}</p> : null}
                </div>
                {statusBadge(row.status)}
              </div>
              <dl className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-500">Uses</dt>
                  <dd>
                    {row.redemption_count}
                    {row.max_redemptions != null ? ` / ${row.max_redemptions}` : " (no cap)"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Per customer</dt>
                  <dd>{row.max_redemptions_per_customer ?? "Unlimited"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Valid</dt>
                  <dd>
                    {row.starts_at ? new Date(row.starts_at).toLocaleString() : "Any time"}
                    {" → "}
                    {row.ends_at ? new Date(row.ends_at).toLocaleString() : "No end"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Sent</dt>
                  <dd>
                    {row.sent_at
                      ? `${row.sent_to_email ?? "—"} · ${new Date(row.sent_at).toLocaleString()}`
                      : "Not recorded"}
                  </dd>
                </div>
              </dl>

              <form action={updatePromotionCode} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={row.id} />
                <div>
                  <label className={labelClass}>Discount type</label>
                  <select name="discount_type" defaultValue={row.discount_type} className={inputClass}>
                    <option value="percent">Percent (%)</option>
                    <option value="fixed_aud">Fixed (AUD)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Discount value</label>
                  <input name="discount_value" type="number" min={0.01} step={0.01} defaultValue={row.discount_value} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Min subtotal</label>
                  <input name="min_subtotal_aud" type="number" min={0} step={0.01} defaultValue={row.min_subtotal_aud} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select name="status" defaultValue={row.status} className={inputClass}>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Valid from</label>
                  <input name="starts_at" type="datetime-local" defaultValue={toLocalDatetimeValue(row.starts_at)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Valid until</label>
                  <input name="ends_at" type="datetime-local" defaultValue={toLocalDatetimeValue(row.ends_at)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Max total uses</label>
                  <input
                    name="max_redemptions"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={row.max_redemptions ?? ""}
                    className={inputClass}
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className={labelClass}>Max per customer</label>
                  <input
                    name="max_redemptions_per_customer"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={row.max_redemptions_per_customer ?? ""}
                    className={inputClass}
                    placeholder="Unlimited"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Note</label>
                  <input name="description" defaultValue={row.description ?? ""} className={inputClass} />
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <button type="submit" className="rounded-lg border border-brand-navy/20 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">
                    Save changes
                  </button>
                </div>
              </form>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <form action={markPromotionCodeSent} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={row.id} />
                  <div>
                    <label className={labelClass}>Record send to</label>
                    <input name="sent_to_email" type="email" required placeholder="customer@example.com" className={`${inputClass} min-w-[220px]`} />
                  </div>
                  <button type="submit" className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                    Mark sent
                  </button>
                </form>
                {row.status === "active" ? (
                  <>
                    <form action={setPromotionCodeStatus}>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="status" value="disabled" />
                      <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Disable
                      </button>
                    </form>
                    <form action={setPromotionCodeStatus}>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="status" value="expired" />
                      <button type="submit" className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50">
                        Expire now
                      </button>
                    </form>
                  </>
                ) : row.status === "disabled" ? (
                  <form action={setPromotionCodeStatus}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="status" value="active" />
                    <button type="submit" className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
                      Reactivate
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

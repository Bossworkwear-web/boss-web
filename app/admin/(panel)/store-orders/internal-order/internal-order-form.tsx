"use client";

import { useEffect, useMemo, useState } from "react";

import { createInternalOrderFromTemplate } from "./actions";

type Item = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  serviceType: string;
  color: string;
  size: string;
  placementsJson: string;
  notes: string;
};

type Template = {
  baseOrderNumber: string;
  customerEmail: string;
  customerName: string;
  deliveryAddress: string;
  currency: string;
  carrier: string;
  deliveryFeeCents: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    serviceType: string | null;
    color: string | null;
    size: string | null;
    placementsJson: string;
    notes: string | null;
  }>;
};

function toItem(t: Template["items"][number]): Item {
  return {
    productId: t.productId ?? "",
    productName: t.productName ?? "",
    quantity: typeof t.quantity === "number" ? t.quantity : 0,
    unitPriceCents: typeof t.unitPriceCents === "number" ? t.unitPriceCents : 0,
    lineTotalCents: typeof t.lineTotalCents === "number" ? t.lineTotalCents : 0,
    serviceType: t.serviceType ?? "",
    color: t.color ?? "",
    size: t.size ?? "",
    placementsJson: t.placementsJson ?? "[]",
    notes: t.notes ?? "",
  };
}

function safeInt(raw: string, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

/** Parse a dollar amount (e.g. "12.50") to integer cents for DB / API. */
function parseDollarsToCents(raw: string): number {
  const s = String(raw).trim().replace(/^\$/, "");
  if (!s) return 0;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollarFieldValue(cents: number): number {
  return Math.round(Number(cents) || 0) / 100;
}

const inputClass =
  "mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function InternalOrderForm({
  template,
  isBlankStarter,
}: {
  template: Template;
  isBlankStarter: boolean;
}) {
  const [baseOrderNumber, setBaseOrderNumber] = useState(template.baseOrderNumber);
  const [customerEmail, setCustomerEmail] = useState(template.customerEmail);
  const [customerName, setCustomerName] = useState(template.customerName);
  const [deliveryAddress, setDeliveryAddress] = useState(template.deliveryAddress);
  const [currency, setCurrency] = useState(template.currency || "AUD");
  const [carrier, setCarrier] = useState(template.carrier || "Australia Post");
  const [status, setStatus] = useState<"paid" | "processing" | "shipped" | "cancelled">("paid");
  const [deliveryFeeCents, setDeliveryFeeCents] = useState<number>(template.deliveryFeeCents ?? 0);
  const [items, setItems] = useState<Item[]>(template.items.map(toItem));

  useEffect(() => {
    setBaseOrderNumber(template.baseOrderNumber);
    setCustomerEmail(template.customerEmail);
    setCustomerName(template.customerName);
    setDeliveryAddress(template.deliveryAddress);
    setCurrency(template.currency || "AUD");
    setCarrier(template.carrier || "Australia Post");
    setDeliveryFeeCents(template.deliveryFeeCents ?? 0);
    setItems(template.items.map(toItem));
  }, [template]);

  const subtotalCents = useMemo(() => items.reduce((sum, it) => sum + (Number(it.lineTotalCents) || 0), 0), [items]);
  const totalCents = subtotalCents + (Number(deliveryFeeCents) || 0);

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((cur) => {
      const next = [...cur];
      next[idx] = { ...next[idx]!, ...patch };
      return next;
    });
  }

  function removeItem(idx: number) {
    setItems((cur) => cur.filter((_, i) => i !== idx));
  }

  function addItem() {
    setItems((cur) => [
      ...cur,
      {
        productId: "",
        productName: "",
        quantity: 1,
        unitPriceCents: 0,
        lineTotalCents: 0,
        serviceType: "",
        color: "",
        size: "",
        placementsJson: "[]",
        notes: "",
      },
    ]);
  }

  return (
    <div id="internal-order-form" className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">
          {isBlankStarter ? "Create order (no template)" : "Edit details"}
        </h2>
        {isBlankStarter ? (
          <div className="mt-2 space-y-3 text-sm text-slate-600">
            <p>
              기존 고객 프로필이 없어도 됩니다. 이메일·메시지·매장 등으로 접수한 내용을 입력한 뒤 저장하세요. 새 Customer Order
              ID는 <span className="font-mono">접두어_1</span>, <span className="font-mono">접두어_2</span> … 순으로 붙습니다.
            </p>
            <div>
              <label className={labelClass}>Base Customer Order ID (optional)</label>
              <input
                className={inputClass}
                value={baseOrderNumber}
                onChange={(e) => setBaseOrderNumber(e.target.value)}
                placeholder="비우면 INT_YYYYMMDD_… 자동 생성"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-slate-500">
                직접 쓰면 그 문자열이 접두어입니다. 비우면 서버가 <span className="font-mono">INT_날짜_임의hex</span>를 한 번 부여합니다.
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Base Customer Order ID:{" "}
            <span className="font-mono font-semibold text-brand-navy">{baseOrderNumber}</span>
            <br />
            저장하면 새 Customer Order ID는 <span className="font-mono">{baseOrderNumber}_count</span> 형태로 생성됩니다.
          </p>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Customer email</label>
            <input className={inputClass} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Customer name</label>
            <input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Delivery address</label>
            <textarea
              className={inputClass}
              rows={4}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Currency</label>
            <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Carrier</label>
            <input className={inputClass} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="paid">paid</option>
              <option value="processing">processing</option>
              <option value="shipped">shipped</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Delivery fee ($)</label>
            <input
              className={inputClass}
              type="number"
              step={0.01}
              min={0}
              value={centsToDollarFieldValue(deliveryFeeCents)}
              onChange={(e) => setDeliveryFeeCents(parseDollarsToCents(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Subtotal ($)</label>
            <input className={inputClass} value={centsToDollarFieldValue(subtotalCents)} readOnly />
          </div>
          <div>
            <label className={labelClass}>Total ($)</label>
            <input className={inputClass} value={centsToDollarFieldValue(totalCents)} readOnly />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-brand-navy">Items</h2>
          <button
            type="button"
            onClick={addItem}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-brand-navy hover:border-brand-orange"
          >
            + Add item
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-[1000px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">Product name</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Unit ($)</th>
                <th className="px-3 py-2">Line total ($)</th>
                <th className="px-3 py-2">Service</th>
                <th className="px-3 py-2">Color</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Placements JSON</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b border-slate-100 align-top last:border-b-0">
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      value={it.productName}
                      onChange={(e) => updateItem(idx, { productName: e.target.value })}
                    />
                    <input
                      className={inputClass}
                      value={it.productId}
                      onChange={(e) => updateItem(idx, { productId: e.target.value })}
                      placeholder="product_id (optional)"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      step={1}
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Math.max(0, safeInt(e.target.value, 0)) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      step={0.01}
                      value={centsToDollarFieldValue(it.unitPriceCents)}
                      onChange={(e) => updateItem(idx, { unitPriceCents: parseDollarsToCents(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      step={0.01}
                      value={centsToDollarFieldValue(it.lineTotalCents)}
                      onChange={(e) => updateItem(idx, { lineTotalCents: parseDollarsToCents(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      value={it.serviceType}
                      onChange={(e) => updateItem(idx, { serviceType: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input className={inputClass} value={it.color} onChange={(e) => updateItem(idx, { color: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <input className={inputClass} value={it.size} onChange={(e) => updateItem(idx, { size: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      className={inputClass}
                      rows={2}
                      value={it.placementsJson}
                      onChange={(e) => updateItem(idx, { placementsJson: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      className={inputClass}
                      rows={2}
                      value={it.notes}
                      onChange={(e) => updateItem(idx, { notes: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-sm text-slate-500">
                    No items. Add at least one item.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <form
          action={createInternalOrderFromTemplate}
          className="mt-5 flex flex-wrap items-center justify-between gap-3"
        >
          <input type="hidden" name="base_order_number" value={baseOrderNumber} />
          <input type="hidden" name="customer_email" value={customerEmail} />
          <input type="hidden" name="customer_name" value={customerName} />
          <input type="hidden" name="delivery_address" value={deliveryAddress} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="carrier" value={carrier} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="delivery_fee_cents" value={String(deliveryFeeCents)} />
          <input type="hidden" name="items_json" value={JSON.stringify(items)} />
          <p className="text-xs text-slate-600">
            저장하면 새 주문이 생성됩니다. (기존 주문은 변경되지 않습니다.)
          </p>
          <button
            type="submit"
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
            disabled={items.length === 0}
          >
            Save as new internal order
          </button>
        </form>
      </section>
    </div>
  );
}


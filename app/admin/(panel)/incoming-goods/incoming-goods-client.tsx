"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { setIncomingGoodsNote, setIncomingGoodsReceivedQty, type IncomingGoodsRowDto } from "./actions";

type Props = {
  initial:
    | { ok: true; rows: IncomingGoodsRowDto[] }
    | { ok: false; error: string; rows: IncomingGoodsRowDto[] };
};

function formatBits(r: IncomingGoodsRowDto): string {
  const bits = [r.color, r.size].map((s) => (s ?? "").trim()).filter(Boolean);
  return bits.length ? bits.join(" · ") : "—";
}

export function IncomingGoodsClient({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initial.ok ? null : initial.error);

  const rows = initial.rows ?? [];
  const [receivedByItemId, setReceivedByItemId] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const r of rows) {
      out[r.itemId] = Number.isFinite(r.qtyReceived) ? r.qtyReceived : 0;
    }
    return out;
  });
  const [noteByItemId, setNoteByItemId] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[r.itemId] = String(r.note ?? "");
    }
    return out;
  });
  const grouped = useMemo(() => {
    const map = new Map<string, { header: IncomingGoodsRowDto; rows: IncomingGoodsRowDto[] }>();
    for (const r of rows) {
      const key = r.storeOrderId;
      const cur = map.get(key);
      if (cur) {
        cur.rows.push(r);
      } else {
        map.set(key, { header: r, rows: [r] });
      }
    }
    return [...map.values()];
  }, [rows]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin</p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Incoming goods</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          스토어 주문의 라인 아이템(오더한 수량)과 입고 처리(Received)를 한 화면에서 봅니다. 입고 수량을 입력하면 즉시 저장됩니다.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p>{error}</p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Variant</th>
              <th className="px-4 py-3">Ordered</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  표시할 오더가 없습니다.
                </td>
              </tr>
            ) : (
              grouped.map(({ header, rows: orderRows }) => (
                <Fragment key={header.storeOrderId}>
                  {orderRows.map((r, idx) => {
                    const receivedQty = receivedByItemId[r.itemId] ?? 0;
                    const complete = receivedQty >= r.qtyOrdered && r.qtyOrdered > 0;
                    const note = noteByItemId[r.itemId] ?? "";
                    return (
                      <tr key={r.itemId} className="border-b border-slate-100 align-top">
                        {idx === 0 ? (
                          <>
                            <td className="px-4 py-3" rowSpan={orderRows.length}>
                              <p className="font-mono font-semibold text-brand-navy">{header.orderNumber}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {header.orderCreatedAt
                                  ? new Date(header.orderCreatedAt).toLocaleString("en-AU", { dateStyle: "medium" })
                                  : "—"}
                              </p>
                            </td>
                            <td className="px-4 py-3" rowSpan={orderRows.length}>
                              <p className="font-medium text-slate-900">{header.customerName || "—"}</p>
                            </td>
                          </>
                        ) : null}

                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-slate-300"
                              checked={complete}
                              disabled={pending || r.qtyOrdered <= 0}
                              onChange={(e) => {
                                const next = e.target.checked ? r.qtyOrdered : 0;
                                setError(null);
                                setReceivedByItemId((cur) => ({ ...cur, [r.itemId]: next }));
                                startTransition(() => {
                                  void (async () => {
                                    const res = await setIncomingGoodsReceivedQty({
                                      storeOrderItemId: r.itemId,
                                      receivedQty: next,
                                    });
                                    if (!res.ok) setError(res.error);
                                  })();
                                });
                              }}
                              aria-label="Mark received"
                            />
                            <p className="font-medium text-slate-900">{r.productName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{formatBits(r)}</td>
                        <td className="px-4 py-3 font-mono tabular-nums">{r.qtyOrdered}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={Number.isFinite(receivedQty) ? receivedQty : 0}
                              disabled={pending}
                              onChange={(e) => {
                                const next = Math.max(0, Math.floor(Number(e.target.value || 0)));
                                setError(null);
                                setReceivedByItemId((cur) => ({ ...cur, [r.itemId]: next }));
                                startTransition(() => {
                                  void (async () => {
                                    const res = await setIncomingGoodsReceivedQty({
                                      storeOrderItemId: r.itemId,
                                      receivedQty: next,
                                    });
                                    if (!res.ok) setError(res.error);
                                  })();
                                });
                              }}
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            />
                            <span className={`text-xs font-semibold ${complete ? "text-emerald-700" : "text-slate-500"}`}>
                              {complete ? "Complete" : "—"}
                            </span>
                          </div>
                          {r.updatedAt ? (
                            <p className="mt-1 text-[0.7rem] text-slate-500">
                              Updated {new Date(r.updatedAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={note}
                            disabled={pending}
                            placeholder="Note…"
                            onChange={(e) => {
                              setNoteByItemId((cur) => ({ ...cur, [r.itemId]: e.target.value }));
                            }}
                            onBlur={() => {
                              setError(null);
                              const latest = (noteByItemId[r.itemId] ?? "").trim();
                              startTransition(() => {
                                void (async () => {
                                  const res = await setIncomingGoodsNote({ storeOrderItemId: r.itemId, note: latest });
                                  if (!res.ok) setError(res.error);
                                })();
                              });
                            }}
                            className="w-full min-w-[12rem] rounded-lg border border-slate-200 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 capitalize">{r.orderStatus}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/store-orders/${encodeURIComponent(r.storeOrderId)}/ordered-items-list`}
                            className="text-xs font-semibold text-brand-orange hover:underline"
                          >
                            Open order info →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


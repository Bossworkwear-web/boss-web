"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { formatPerthDate, formatPerthDateTimeShort } from "@/lib/perth-calendar";
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

function parseMs(iso: string | null | undefined): number {
  if (!iso?.trim()) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

const LINES_PER_PAGE = 30;

type IncomingGoodsGroup = {
  header: IncomingGoodsRowDto;
  rows: IncomingGoodsRowDto[];
  orderCreatedMs: number;
};

function lineIsIncomplete(r: IncomingGoodsRowDto, receivedByItemId: Record<string, number>): boolean {
  if (r.qtyOrdered <= 0) return false;
  const received = receivedByItemId[r.itemId] ?? r.qtyReceived;
  return received < r.qtyOrdered;
}

function groupMatchesOrderQuery(g: IncomingGoodsGroup, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const num = (g.header.orderNumber ?? "").toLowerCase();
  const sid = (g.header.storeOrderId ?? "").toLowerCase();
  const qCompact = q.replace(/-/g, "");
  const sidCompact = sid.replace(/-/g, "");
  return num.includes(q) || sid.includes(q) || (qCompact.length > 0 && sidCompact.includes(qCompact));
}

function chunkGroupsByLineLimit(groups: IncomingGoodsGroup[], lineLimit: number): IncomingGoodsGroup[][] {
  if (groups.length === 0) return [];
  const pages: IncomingGoodsGroup[][] = [];
  let cur: IncomingGoodsGroup[] = [];
  let lineCount = 0;
  for (const g of groups) {
    const n = g.rows.length;
    if (n > lineLimit) {
      if (cur.length) {
        pages.push(cur);
        cur = [];
        lineCount = 0;
      }
      pages.push([g]);
      continue;
    }
    if (lineCount + n > lineLimit && cur.length > 0) {
      pages.push(cur);
      cur = [];
      lineCount = 0;
    }
    cur.push(g);
    lineCount += n;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

function PaginationBar(props: {
  page: number;
  totalPages: number;
  linesThisPage: number;
  totalLines: number;
  onPrev: () => void;
  onNext: () => void;
  disabledPrev: boolean;
  disabledNext: boolean;
}) {
  const { page, totalPages, linesThisPage, totalLines, onPrev, onNext, disabledPrev, disabledNext } = props;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm text-slate-700">
        <span className="font-semibold text-brand-navy">
          Page {page} / {totalPages}
        </span>
        <span className="mx-2 text-slate-300">·</span>
        <span className="text-slate-600">
          {linesThisPage} line{linesThisPage === 1 ? "" : "s"} on this page
        </span>
        <span className="ml-2 text-xs text-slate-500">({totalLines} total · up to {LINES_PER_PAGE} lines per page)</span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={disabledPrev}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disabledNext}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function IncomingGoodsClient({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initial.ok ? null : initial.error);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [orderIdQuery, setOrderIdQuery] = useState("");

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
    const map = new Map<string, IncomingGoodsGroup>();
    for (const r of rows) {
      const key = r.storeOrderId;
      const cur = map.get(key);
      if (cur) {
        cur.rows.push(r);
      } else {
        map.set(key, {
          header: r,
          rows: [r],
          orderCreatedMs: parseMs(r.orderCreatedAt),
        });
      }
    }
    const out = [...map.values()];
    for (const g of out) {
      g.rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    out.sort((a, b) => {
      const d = b.orderCreatedMs - a.orderCreatedMs;
      if (d !== 0) return d;
      return b.header.orderNumber.localeCompare(a.header.orderNumber);
    });
    return out;
  }, [rows]);

  const filteredGrouped = useMemo(() => {
    let list = grouped;
    if (incompleteOnly) {
      list = list.filter((g) => g.rows.some((r) => lineIsIncomplete(r, receivedByItemId)));
    }
    if (orderIdQuery.trim()) {
      list = list.filter((g) => groupMatchesOrderQuery(g, orderIdQuery));
    }
    return list;
  }, [grouped, incompleteOnly, orderIdQuery, receivedByItemId]);

  const pages = useMemo(() => chunkGroupsByLineLimit(filteredGrouped, LINES_PER_PAGE), [filteredGrouped]);
  const totalLines = useMemo(() => filteredGrouped.reduce((s, g) => s + g.rows.length, 0), [filteredGrouped]);
  const totalPages = Math.max(1, pages.length || 1);

  const [page, setPage] = useState(1);
  const dataVersion = useMemo(
    () => rows.map((r) => `${r.itemId}:${r.qtyReceived}:${r.qtyOrdered}:${r.sortOrder}`).join("|"),
    [rows],
  );
  const [dataVersionSnapshot, setDataVersionSnapshot] = useState(dataVersion);
  if (dataVersion !== dataVersionSnapshot) {
    setDataVersionSnapshot(dataVersion);
    setPage(1);
  }

  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const pageIndex = pageClamped - 1;
  const pageGroups = pages[pageIndex] ?? [];
  const linesThisPage = pageGroups.reduce((s, g) => s + g.rows.length, 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin</p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Incoming goods</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          스토어 주문의 라인 아이템(오더한 수량)과 입고 처리(Received)를 한 화면에서 봅니다. 입고 수량을 입력하면 즉시 저장됩니다. 목록은
          주문일 최신순이며, <strong>{LINES_PER_PAGE}줄</strong>마다 페이지로 나뉩니다 (한 주문은 같은 페이지에 묶입니다).
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => {
              setIncompleteOnly(false);
              setOrderIdQuery("");
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition hover:bg-slate-50"
          >
            Default
          </button>
          <button
            type="button"
            aria-pressed={incompleteOnly}
            onClick={() => {
              setIncompleteOnly((v) => !v);
              setPage(1);
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              incompleteOnly
                ? "border-brand-orange bg-brand-orange text-white shadow-sm hover:bg-brand-orange/90"
                : "border-slate-300 bg-white text-brand-navy hover:bg-slate-50"
            }`}
          >
            Search incomplete list
          </button>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:min-w-[16rem] sm:flex-initial">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search by order ID</span>
            <input
              type="search"
              value={orderIdQuery}
              onChange={(e) => {
                setOrderIdQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Order number or store order UUID…"
              className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p>{error}</p>
        </div>
      ) : null}

      {grouped.length === 0 ? (
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
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  표시할 오더가 없습니다.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : filteredGrouped.length === 0 ? (
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
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  조건에 맞는 오더가 없습니다. 필터를 바꿔 보세요.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {totalPages > 1 ? (
            <PaginationBar
              page={pageClamped}
              totalPages={totalPages}
              linesThisPage={linesThisPage}
              totalLines={totalLines}
              onPrev={() => setPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, Math.max(1, p) + 1))}
              disabledPrev={pageClamped <= 1}
              disabledNext={pageClamped >= totalPages}
            />
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
                {pageGroups.map(({ header, rows: orderRows }) => (
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
                                    ? formatPerthDate(header.orderCreatedAt)
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
                                Updated{" "}
                                {formatPerthDateTimeShort(r.updatedAt)}
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
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <PaginationBar
              page={pageClamped}
              totalPages={totalPages}
              linesThisPage={linesThisPage}
              totalLines={totalLines}
              onPrev={() => setPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, Math.max(1, p) + 1))}
              disabledPrev={pageClamped <= 1}
              disabledNext={pageClamped >= totalPages}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}


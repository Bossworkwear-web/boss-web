"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { Database } from "@/lib/database.types";
import { supplierLineDisplayReceivedYmd } from "@/lib/incoming-goods-received-lookup";
import { getPerthYmd } from "@/lib/perth-calendar";
import { supplierOrderProductIdHeadTail } from "@/lib/supplier-order-product-id-parts";
import { normalizeSupplierOrderLineSupplierValue } from "@/lib/supplier-order-supplier-normalize";

import {
  applyCatalogSupplierNameIfEmpty,
  createSupplierOrderLine,
  deleteSupplierOrderLine,
  updateSupplierOrderLine,
} from "./actions";

type SupplierOrderLineRow = Database["public"]["Tables"]["supplier_order_lines"]["Row"];

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export type SupplierDayOrderTableProps = {
  listDateYmd: string;
  listDateTitle: string;
  lines: SupplierOrderLineRow[];
  migrationHint: string | null;
  /** Completed Order → Pre-process documents links (read-only sheet). */
  completeOrdersDocumentsView?: boolean;
  /** Warehouse Manager link: print / view only (same edit lock as documents view). */
  warehouseManagerView?: boolean;
  /** Recent `store_orders.order_number` values (Customer order ID) for datalist suggestions. */
  storeOrderNumberOptions?: string[];
  /** Distinct `products.supplier_name` for Supplier column datalist. */
  productSupplierNameOptions?: string[];
  /** Trimmed `product_id` → first catalog image URL (`products.image_urls[0]`). */
  productImageByProductKey?: Record<string, string | null>;
  /** Incoming goods: fully-received Perth date per `store_order_items.id` (same as Admin → Incoming goods). */
  incomingReceivedYmdByStoreItemId?: Record<string, string | null>;
  onPrint: () => void;
};

function lineTotalCents(row: SupplierOrderLineRow) {
  return Math.max(0, row.quantity) * Math.max(0, row.unit_price_cents);
}

/** OK toggle: sync `sheet_row_ok` and optionally set `ordered_date` to Perth today when checking and date is empty. */
function computeLineAckRowUpdate(
  prev: SupplierOrderLineRow[],
  rowId: string,
  checked: boolean,
):
  | { next: SupplierOrderLineRow[]; patch: { sheet_row_ok: boolean; ordered_date?: string | null } }
  | null {
  const row = prev.find((r) => r.id === rowId);
  if (!row) return null;
  if (!checked) {
    return {
      next: prev.map((r) => (r.id === rowId ? { ...r, sheet_row_ok: false } : r)),
      patch: { sheet_row_ok: false },
    };
  }
  const todayYmd = getPerthYmd().ymd;
  const hadOrdered = Boolean(row.ordered_date?.trim());
  return {
    next: prev.map((r) =>
      r.id === rowId
        ? { ...r, sheet_row_ok: true, ordered_date: hadOrdered ? r.ordered_date : todayYmd }
        : r,
    ),
    patch: hadOrdered ? { sheet_row_ok: true } : { sheet_row_ok: true, ordered_date: todayYmd },
  };
}

export function SupplierDayOrderTable({
  listDateYmd,
  listDateTitle,
  lines: initialLines,
  migrationHint,
  completeOrdersDocumentsView = false,
  warehouseManagerView = false,
  storeOrderNumberOptions = [],
  productSupplierNameOptions = [],
  productImageByProductKey = {},
  incomingReceivedYmdByStoreItemId = {},
  onPrint,
}: SupplierDayOrderTableProps) {
  const editLocked = Boolean(migrationHint) || completeOrdersDocumentsView || warehouseManagerView;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /** Per–order-line OK flag (optional acknowledgment). */
  const [lineAck, setLineAck] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialLines.map((r) => [r.id, Boolean(r.sheet_row_ok)])),
  );
  const [rows, setRows] = useState(initialLines);
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);
  const [unitAudText, setUnitAudText] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialLines.map((r) => [r.id, (r.unit_price_cents / 100).toFixed(2)])),
  );
  const [errorText, setErrorText] = useState<string | null>(null);
  /** Product ID cell: split-styled view vs plain input while editing. */
  const [productIdFocusedId, setProductIdFocusedId] = useState<string | null>(null);
  /** Product image cell: click to enlarge in-row; click again (or another row) to shrink. */
  const [expandedImageLineId, setExpandedImageLineId] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialLines);
    setUnitAudText(
      Object.fromEntries(initialLines.map((r) => [r.id, (r.unit_price_cents / 100).toFixed(2)])),
    );
    setProductIdFocusedId(null);
    setExpandedImageLineId(null);
    setLineAck((prev) => {
      const next: Record<string, boolean> = {};
      for (const r of initialLines) {
        next[r.id] = prev[r.id] ?? Boolean(r.sheet_row_ok);
      }
      return next;
    });
  }, [initialLines]);

  function setLineAckForRow(rowId: string, checked: boolean) {
    setLineAck((prev) => ({ ...prev, [rowId]: checked }));

    if (editLocked) return;

    setRows((prev) => {
      const u = computeLineAckRowUpdate(prev, rowId, checked);
      if (!u) return prev;
      queueMicrotask(() => {
        void runSave(() => updateSupplierOrderLine(rowId, u.patch));
      });
      return u.next;
    });
  }

  function refresh() {
    router.refresh();
  }

  async function runSave(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErrorText(null);
    const result = await fn();
    if (!result.ok) {
      setErrorText(result.error ?? "Save failed");
      refresh();
      return;
    }
    refresh();
  }

  function addRow() {
    setErrorText(null);
    startTransition(() => {
      void (async () => {
        const result = await createSupplierOrderLine(listDateYmd, "Manual Input");
        if (!result.ok) {
          setErrorText(result.error);
          return;
        }
        refresh();
      })();
    });
  }

  function removeRow(id: string) {
    if (!window.confirm("Delete this row?")) return;
    setErrorText(null);
    startTransition(() => {
      void (async () => {
        const result = await deleteSupplierOrderLine(id);
        if (!result.ok) {
          setErrorText(result.error);
          return;
        }
        refresh();
      })();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p id={`supplier-sheet-${listDateYmd}`} className="text-base font-semibold text-brand-navy">
            {listDateTitle}
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">{listDateYmd} · Australia/Perth worksheet</p>
          <p className="mt-2 text-xs text-slate-600">
            <strong>Unit (AUD)</strong> per unit; line = qty × unit. Edits save on blur / date change (Ordered only).{" "}
            <strong>Received</strong> is read-only: linked store lines match{" "}
            <strong className="text-brand-navy">Admin → Incoming goods</strong>; other lines show the saved worksheet
            date.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onPrint}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition hover:bg-slate-50"
          >
            Print
          </button>
          <button
            type="button"
            disabled={pending || editLocked}
            onClick={addRow}
            className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy transition hover:brightness-95 disabled:opacity-50"
          >
            {pending ? "Working…" : "Add row"}
          </button>
        </div>
      </div>

      {migrationHint && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm whitespace-pre-wrap text-amber-900">
          {migrationHint}
        </p>
      )}
      {completeOrdersDocumentsView && !migrationHint ? (
        <p className="border-b border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-800">
          Completed Order 문서 보기 모드: 시트를 수정할 수 없습니다.
        </p>
      ) : null}
      {warehouseManagerView && !migrationHint && !completeOrdersDocumentsView ? (
        <p className="border-b border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-800">
          창고 매니저 보기: 인쇄·열람만 가능합니다. 수정·삭제·행 추가는 사용할 수 없습니다.
        </p>
      ) : null}

      {errorText && (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800" role="alert">
          {errorText}
        </p>
      )}

      <div className="overflow-x-auto">
        <datalist id={`supplier-store-order-ids-${listDateYmd}`}>
          {storeOrderNumberOptions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <datalist id={`supplier-catalog-names-${listDateYmd}`}>
          {productSupplierNameOptions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th
                className="w-10 px-1 py-2 text-center"
                title="Line OK. Web-linked rows (store item) also update Admin → Incoming goods received qty."
              >
                OK
              </th>
              <th className="px-2 py-2" title="Matches products.supplier_name in catalog">
                Supplier name
              </th>
              <th className="px-2 py-2">Customer order ID</th>
              <th className="w-[88px] px-2 py-2 text-center" title="First image from catalog (products.image_urls)">
                Image
              </th>
              <th className="px-2 py-2">Product ID</th>
              <th className="px-2 py-2">Colour</th>
              <th className="px-2 py-2">Size</th>
              <th className="px-2 py-2 w-24">Qty</th>
              <th className="px-2 py-2 w-36">Ordered</th>
              <th className="px-2 py-2 w-36" title="Store-linked lines: from Admin → Incoming goods (read-only). Otherwise legacy saved date.">
                Received
              </th>
              <th className="px-2 py-2 w-28">Unit (AUD)</th>
              <th className="px-2 py-2 w-28">Line</th>
              <th className="w-20 px-2 py-2" />
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                  No lines for this date yet. Use <strong>Add row</strong> to add one.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.id}-${row.updated_at}`}
                  data-so-line-id={row.id}
                  className="border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className="px-1 py-2 align-top">
                    <input
                      type="checkbox"
                      className="mx-auto block h-4 w-4 rounded border-slate-300"
                      checked={Boolean(lineAck[row.id])}
                      disabled={editLocked}
                      aria-label={`Line OK: ${row.product_id || row.id}`}
                      onChange={(e) => setLineAckForRow(row.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      data-so-field="supplier"
                      className="w-full min-w-[100px] rounded border border-slate-200 px-2 py-1 text-sm uppercase"
                      defaultValue={normalizeSupplierOrderLineSupplierValue(row.supplier ?? "")}
                      disabled={editLocked}
                      list={`supplier-catalog-names-${listDateYmd}`}
                      placeholder="supplier_name"
                      title="Catalog field products.supplier_name — pick a suggestion or type your own"
                      onBlur={(e) => {
                        const v = normalizeSupplierOrderLineSupplierValue(e.target.value);
                        const prevNorm = normalizeSupplierOrderLineSupplierValue(row.supplier ?? "");
                        if (v === prevNorm) return;
                        e.target.value = v;
                        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, supplier: v } : r)));
                        void runSave(() => updateSupplierOrderLine(row.id, { supplier: v }));
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      data-so-field="customer_order_id"
                      className="w-full min-w-[120px] rounded border border-slate-200 px-2 py-1 font-mono text-sm"
                      defaultValue={row.customer_order_id}
                      disabled={editLocked}
                      list={`supplier-store-order-ids-${listDateYmd}`}
                      placeholder="BOS_… from Store orders"
                      title="Same as Customer order ID on Store orders (store_orders.order_number)"
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v === row.customer_order_id) return;
                        setRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, customer_order_id: v } : r)),
                        );
                        void runSave(() => updateSupplierOrderLine(row.id, { customer_order_id: v }));
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    {(() => {
                      const src = productImageByProductKey[row.product_id.trim()] ?? null;
                      if (!src) {
                        return (
                          <span className="flex h-14 w-[72px] items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 text-[10px] text-slate-400">
                            —
                          </span>
                        );
                      }
                      const expanded = expandedImageLineId === row.id;
                      return (
                        <button
                          type="button"
                          className={`block rounded border border-slate-200 bg-white p-0 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/35 ${
                            expanded ? "cursor-zoom-out ring-2 ring-brand-navy/30" : "cursor-zoom-in hover:ring-1 hover:ring-slate-300"
                          }`}
                          aria-expanded={expanded}
                          aria-label={expanded ? "Shrink product image" : "Enlarge product image"}
                          title={expanded ? "Click to shrink" : "Click to enlarge"}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpandedImageLineId((id) => (id === row.id ? null : row.id));
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- remote catalog URLs (Supabase etc.) */}
                          <img
                            src={src}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className={
                              expanded
                                ? "max-h-[min(49vh,252px)] max-w-[min(64.4vw,252px)] h-auto w-auto rounded object-contain"
                                : "h-14 w-[72px] rounded object-contain"
                            }
                          />
                        </button>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-2 align-top">
                    {productIdFocusedId === row.id && !editLocked ? (
                      <input
                        data-so-field="product_id"
                        className="w-full min-w-[80px] rounded border border-slate-200 px-2 py-1 font-mono text-sm uppercase"
                        defaultValue={row.product_id}
                        autoFocus
                        aria-label="Product ID"
                        onBlur={(e) => {
                          setProductIdFocusedId(null);
                          const v = e.target.value.trim();
                          if (v === row.product_id) return;
                          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, product_id: v } : r)));
                          void runSave(async () => {
                            const r1 = await updateSupplierOrderLine(row.id, { product_id: v });
                            if (!r1.ok) return r1;
                            const r2 = await applyCatalogSupplierNameIfEmpty(row.id, v.trim().toUpperCase());
                            if (r2.ok && r2.supplier) {
                              setRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, supplier: r2.supplier! } : r)),
                              );
                            }
                            return r1;
                          });
                        }}
                      />
                    ) : (
                      <div
                        className={`w-full min-w-[80px] rounded border border-slate-200 px-2 py-1 font-mono text-sm uppercase inline-flex flex-wrap items-baseline gap-0 break-all ${
                          editLocked ? "" : "cursor-text hover:bg-slate-50/80"
                        }`}
                        tabIndex={editLocked ? -1 : 0}
                        role={editLocked ? undefined : "button"}
                        aria-label={editLocked ? undefined : "Edit product ID"}
                        onClick={() => {
                          if (!editLocked) setProductIdFocusedId(row.id);
                        }}
                        onKeyDown={(e) => {
                          if (editLocked) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setProductIdFocusedId(row.id);
                          }
                        }}
                      >
                        {(() => {
                          const raw = row.product_id ?? "";
                          const pt = supplierOrderProductIdHeadTail(raw);
                          if (!raw) {
                            return <span className="text-slate-400">{"\u00a0"}</span>;
                          }
                          if (!pt) {
                            return <span>{raw}</span>;
                          }
                          return (
                            <>
                              <span className="text-slate-500/60">
                                {pt.head}
                                <span aria-hidden="true">-</span>
                              </span>
                              <span className="text-[1.2em] font-bold leading-normal text-slate-900">
                                {pt.tail}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      data-so-field="colour"
                      className="w-full min-w-[72px] rounded border border-slate-200 px-2 py-1 text-sm"
                      defaultValue={row.colour}
                      disabled={editLocked}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v === row.colour) return;
                        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, colour: v } : r)));
                        void runSave(() => updateSupplierOrderLine(row.id, { colour: v }));
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      data-so-field="size"
                      className="w-full min-w-[56px] rounded border border-slate-200 px-2 py-1 text-sm"
                      defaultValue={row.size}
                      disabled={editLocked}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v === row.size) return;
                        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, size: v } : r)));
                        void runSave(() => updateSupplierOrderLine(row.id, { size: v }));
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      data-so-field="quantity"
                      type="number"
                      min={0}
                      className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-sm"
                      defaultValue={row.quantity}
                      disabled={editLocked}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        const q = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
                        if (q === row.quantity) return;
                        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, quantity: q } : r)));
                        void runSave(() => updateSupplierOrderLine(row.id, { quantity: q }));
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      type="date"
                      className="w-full rounded border border-slate-200 px-1 py-1 text-xs"
                      value={row.ordered_date ?? ""}
                      disabled={editLocked}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ordered_date: v } : r)));
                        void runSave(() => updateSupplierOrderLine(row.id, { ordered_date: v }));
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div
                      className="min-h-[2rem] rounded border border-slate-100 bg-slate-50/80 px-2 py-1 font-mono text-xs text-slate-800 tabular-nums"
                      title={
                        row.store_order_item_id
                          ? "Synced from Incoming goods when this line is linked to a store order item."
                          : "Legacy worksheet date (no store item link)."
                      }
                    >
                      {supplierLineDisplayReceivedYmd(row, incomingReceivedYmdByStoreItemId) ?? "—"}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      data-so-field="unit_price_aud"
                      type="text"
                      inputMode="decimal"
                      className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-sm"
                      value={
                        unitAudText[row.id] !== undefined
                          ? unitAudText[row.id]
                          : (row.unit_price_cents / 100).toFixed(2)
                      }
                      disabled={editLocked}
                      onChange={(e) => {
                        setUnitAudText((prev) => ({ ...prev, [row.id]: e.target.value }));
                      }}
                      onBlur={() => {
                        const raw = unitAudText[row.id] ?? "";
                        const n = Number.parseFloat(raw.replace(/,/g, ""));
                        const cents = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
                        if (cents === row.unit_price_cents) return;
                        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, unit_price_cents: cents } : r)));
                        setUnitAudText((prev) => ({ ...prev, [row.id]: (cents / 100).toFixed(2) }));
                        void runSave(() => updateSupplierOrderLine(row.id, { unit_price_cents: cents }));
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 align-top font-mono text-xs text-slate-700">
                    {aud.format(lineTotalCents(row) / 100)}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <button
                      type="button"
                      disabled={editLocked || pending}
                      onClick={() => removeRow(row.id)}
                      className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

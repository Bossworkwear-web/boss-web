"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { Database } from "@/lib/database.types";
import { supplierOrderProductIdHeadTail } from "@/lib/supplier-order-product-id-parts";
import { normalizeSupplierOrderLineSupplierValue } from "@/lib/supplier-order-supplier-normalize";

import {
  applyCatalogSupplierNameIfEmpty,
  createSupplierOrderLine,
  deleteSupplierOrderLine,
  saveSupplierOrdersDaySheetSnapshot,
  setSupplierDailySheetReadyForProcessing,
  updateSupplierOrderLine,
  type SupplierDaySheetLineSnapshot,
} from "./actions";

type SupplierOrderLineRow = Database["public"]["Tables"]["supplier_order_lines"]["Row"];

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export type SupplierDayOrderTableProps = {
  listDateYmd: string;
  listDateTitle: string;
  lines: SupplierOrderLineRow[];
  migrationHint: string | null;
  /** Complete Orders pre-process doc hub: no edits, ready toggle, or row changes. */
  completeOrdersDocumentsView?: boolean;
  /** When true, this Perth worksheet appears on Click Up. */
  readyForProcessing: boolean;
  /** Recent `store_orders.order_number` values (Customer order ID) for datalist suggestions. */
  storeOrderNumberOptions?: string[];
  /** Distinct `products.supplier_name` for Supplier column datalist. */
  productSupplierNameOptions?: string[];
  /** Trimmed `product_id` → first catalog image URL (`products.image_urls[0]`). */
  productImageByProductKey?: Record<string, string | null>;
  onPrint: () => void;
};

function lineTotalCents(row: SupplierOrderLineRow) {
  return Math.max(0, row.quantity) * Math.max(0, row.unit_price_cents);
}

export function SupplierDayOrderTable({
  listDateYmd,
  listDateTitle,
  lines: initialLines,
  migrationHint,
  completeOrdersDocumentsView = false,
  readyForProcessing: readyForProcessingProp,
  storeOrderNumberOptions = [],
  productSupplierNameOptions = [],
  productImageByProductKey = {},
  onPrint,
}: SupplierDayOrderTableProps) {
  const editLocked = Boolean(migrationHint) || completeOrdersDocumentsView;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingReady, startReadyTransition] = useTransition();
  const [readyForProcessing, setReadyForProcessing] = useState(readyForProcessingProp);
  /** Per–order-line acknowledgment; all must be true to turn on Ready for Processing. */
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

  useEffect(() => {
    setReadyForProcessing(readyForProcessingProp);
  }, [readyForProcessingProp]);

  const lineIdsKey = rows
    .map((r) => r.id)
    .sort()
    .join("|");
  const prevReadyPropRef = useRef<boolean | null>(null);
  const prevLineIdsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const readyPropChanged = prevReadyPropRef.current !== readyForProcessingProp;
    const idsKeyChanged = prevLineIdsKeyRef.current !== lineIdsKey;
    prevReadyPropRef.current = readyForProcessingProp;
    prevLineIdsKeyRef.current = lineIdsKey;

    if (readyPropChanged) {
      setLineAck((prev) => {
        const next: Record<string, boolean> = {};
        for (const r of rows) {
          if (readyForProcessingProp) {
            next[r.id] = prev[r.id] ?? Boolean(r.sheet_row_ok);
          } else {
            next[r.id] = false;
          }
        }
        return next;
      });
      return;
    }

    if (idsKeyChanged) {
      setLineAck((prev) => {
        const next: Record<string, boolean> = {};
        for (const r of rows) {
          next[r.id] = prev[r.id] ?? false;
        }
        return next;
      });
    }
  }, [readyForProcessingProp, lineIdsKey, rows]);

  const prevRowIdSetRef = useRef<Set<string>>(new Set());
  const rowIdSyncPrimedRef = useRef(false);
  useEffect(() => {
    const nextSet = new Set(rows.map((r) => r.id));
    const prevSet = prevRowIdSetRef.current;

    if (!rowIdSyncPrimedRef.current) {
      rowIdSyncPrimedRef.current = true;
      prevRowIdSetRef.current = nextSet;
      return;
    }

    const added = rows.filter((r) => !prevSet.has(r.id));
    prevRowIdSetRef.current = nextSet;

    if (migrationHint || completeOrdersDocumentsView) return;
    if (!readyForProcessing || added.length === 0) return;

    setErrorText(null);
    setReadyForProcessing(false);
    startReadyTransition(async () => {
      const result = await setSupplierDailySheetReadyForProcessing(listDateYmd, false);
      if (!result.ok) {
        setErrorText(result.error);
        return;
      }
      router.refresh();
    });
  }, [rows, readyForProcessing, listDateYmd, router, migrationHint, completeOrdersDocumentsView]);

  useEffect(() => {
    if (migrationHint || completeOrdersDocumentsView || !readyForProcessing || rows.length > 0) return;
    setErrorText(null);
    setReadyForProcessing(false);
    startReadyTransition(async () => {
      const result = await setSupplierDailySheetReadyForProcessing(listDateYmd, false);
      if (!result.ok) {
        setErrorText(result.error);
        return;
      }
      router.refresh();
    });
  }, [migrationHint, completeOrdersDocumentsView, rows.length, readyForProcessing, listDateYmd, router]);

  function setLineAckForRow(rowId: string, checked: boolean) {
    setLineAck((prev) => ({ ...prev, [rowId]: checked }));
    if (readyForProcessing && !checked) {
      setErrorText(null);
      setReadyForProcessing(false);
      startReadyTransition(async () => {
        const result = await setSupplierDailySheetReadyForProcessing(listDateYmd, false);
        if (!result.ok) {
          setErrorText(result.error);
          return;
        }
        router.refresh();
      });
    }
  }

  /** Reads current cell values from the table (including un‑blurred edits) plus dates from React state. */
  function collectDaySheetSnapshot(sheetRowOkById: Record<string, boolean>): SupplierDaySheetLineSnapshot[] | null {
    if (rows.length === 0) return [];
    const root = tbodyRef.current;
    if (!root) return null;
    const out: SupplierDaySheetLineSnapshot[] = [];
    for (const row of rows) {
      const tr = root.querySelector(`tr[data-so-line-id="${row.id}"]`);
      if (!tr) return null;
      const g = (name: string) =>
        (tr.querySelector(`[data-so-field="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | null)?.value;
      const supplier = normalizeSupplierOrderLineSupplierValue(g("supplier") ?? "");
      const customer_order_id = (g("customer_order_id") ?? "").trim();
      const productInp = tr.querySelector('[data-so-field="product_id"]') as HTMLInputElement | null;
      const product_id = (productInp?.value ?? row.product_id).trim();
      const colour = (g("colour") ?? "").trim();
      const size = (g("size") ?? "").trim();
      const qtyRaw =
        (tr.querySelector('[data-so-field="quantity"]') as HTMLInputElement | null)?.value ?? String(row.quantity);
      const n = Number(qtyRaw);
      const quantity = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      const unitRaw =
        (tr.querySelector('[data-so-field="unit_price_aud"]') as HTMLInputElement | null)?.value ?? "";
      const unitParsed = Number.parseFloat(unitRaw.replace(/,/g, ""));
      const unit_price_cents =
        Number.isFinite(unitParsed) && unitParsed >= 0
          ? Math.round(unitParsed * 100)
          : row.unit_price_cents;
      out.push({
        id: row.id,
        supplier,
        customer_order_id,
        product_id: product_id.toUpperCase(),
        colour,
        size,
        quantity,
        ordered_date: row.ordered_date,
        received_date: row.received_date,
        notes: row.notes,
        unit_price_cents,
        sheet_row_ok: Boolean(sheetRowOkById[row.id]),
      });
    }
    return out;
  }

  const allLinesAcknowledged = rows.length > 0 && rows.every((r) => lineAck[r.id]);
  const canTurnReadyOn = allLinesAcknowledged;
  const readyMasterDisabled =
    editLocked ||
    pendingReady ||
    (!readyForProcessing && !canTurnReadyOn) ||
    rows.length === 0;

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
            <strong>Unit (AUD)</strong> per unit; line = qty × unit. Edits save on blur / date change.
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
          Complete Orders 문서 보기 모드: 시트를 수정하거나 Ready for Processing을 바꿀 수 없습니다.
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
              <th className="w-10 px-1 py-2 text-center" title="Check each line before marking the sheet Ready for Processing">
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
              <th className="px-2 py-2 w-36">Received</th>
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
                    <input
                      type="date"
                      className="w-full rounded border border-slate-200 px-1 py-1 text-xs"
                      value={row.received_date ?? ""}
                      disabled={editLocked}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, received_date: v } : r)));
                        void runSave(() => updateSupplierOrderLine(row.id, { received_date: v }));
                      }}
                    />
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

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <label
          className={`flex items-start gap-3 text-sm text-slate-800 ${readyMasterDisabled && !readyForProcessing ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
        >
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 disabled:cursor-not-allowed"
            checked={readyForProcessing}
            disabled={readyMasterDisabled}
            onChange={(e) => {
              setErrorText(null);
              const checked = e.target.checked;
              if (!checked) {
                setReadyForProcessing(false);
                startReadyTransition(async () => {
                  const result = await setSupplierDailySheetReadyForProcessing(listDateYmd, false);
                  if (!result.ok) {
                    setReadyForProcessing(true);
                    setErrorText(result.error);
                    return;
                  }
                  router.refresh();
                });
                return;
              }
              if (!canTurnReadyOn) return;
              const prevAck = { ...lineAck };
              const allOk: Record<string, boolean> = Object.fromEntries(rows.map((r) => [r.id, true]));
              setLineAck(allOk);
              setReadyForProcessing(true);
              startReadyTransition(async () => {
                const snap = collectDaySheetSnapshot(allOk);
                if (snap === null) {
                  setReadyForProcessing(false);
                  setLineAck(prevAck);
                  setErrorText("Could not read the table. Refresh the page and try again.");
                  return;
                }
                const saved = await saveSupplierOrdersDaySheetSnapshot(listDateYmd, snap);
                if (!saved.ok) {
                  setReadyForProcessing(false);
                  setLineAck(prevAck);
                  setErrorText(saved.error);
                  return;
                }
                const readyRes = await setSupplierDailySheetReadyForProcessing(listDateYmd, true);
                if (!readyRes.ok) {
                  setReadyForProcessing(false);
                  setLineAck(prevAck);
                  setErrorText(readyRes.error);
                  return;
                }
                router.refresh();
              });
            }}
          />
          <span>
            <span className="font-semibold">Ready for Processing</span>
            <span className="mt-0.5 block text-xs text-slate-600">
              Every product row must be checked (OK) above. Turning this on saves the whole worksheet (all fields and
              dates), marks every line OK, then adds this date to{" "}
              <strong className="text-brand-navy">Click Up</strong>. Uncheck to remove from that list.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

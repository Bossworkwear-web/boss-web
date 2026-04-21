"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { setProductsStorefrontHidden, setProductStorefrontHidden, updateProductStock } from "./actions";

export type StockRow = {
  id: string;
  name: string;
  category: string | null;
  supplierName: string | null;
  stock_quantity: number;
  storefront_hidden: boolean | null;
  storefront_hidden_at: string | null;
  imageUrl: string | null;
};

type StockTableProps = {
  products: StockRow[];
  lowStockThreshold: number;
};

export function StockTable({ products, lowStockThreshold }: StockTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [hiddenMessage, setHiddenMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");
  const [brand, setBrand] = useState<string>("__ALL__");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const brandOptions = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const p of products) {
      const name = (p.supplierName ?? "").trim();
      if (!name) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (filter === "hidden") {
      return products.filter((p) => Boolean(p.storefront_hidden));
    }
    if (filter === "visible") {
      return products.filter((p) => !p.storefront_hidden);
    }
    return products;
  }, [filter, products]);

  const filteredByBrand = useMemo(() => {
    if (brand === "__ALL__") return filteredProducts;
    if (brand === "__UNKNOWN__") return filteredProducts.filter((p) => !(p.supplierName ?? "").trim());
    return filteredProducts.filter((p) => (p.supplierName ?? "").trim() === brand);
  }, [brand, filteredProducts]);

  function saveRow(productId: string, value: string) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) {
      setMessage({ id: productId, text: "Enter a whole number ≥ 0", ok: false });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await updateProductStock(productId, n);
      if (result.ok) {
        setMessage({ id: productId, text: "Saved", ok: true });
        router.refresh();
      } else {
        setMessage({ id: productId, text: result.error, ok: false });
      }
    });
  }

  function toggleHidden(productId: string, nextHidden: boolean) {
    setHiddenMessage(null);
    startTransition(async () => {
      const result = await setProductStorefrontHidden(productId, nextHidden);
      if (result.ok) {
        setHiddenMessage({ id: productId, text: nextHidden ? "Hidden" : "Visible", ok: true });
        router.refresh();
      } else {
        setHiddenMessage({ id: productId, text: result.error, ok: false });
      }
    });
  }

  function toggleSelected(id: string, on: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(on: boolean) {
    setSelected(() => {
      if (!on) return new Set();
      return new Set(filteredByBrand.map((p) => p.id));
    });
  }

  const selectedCount = selected.size;
  const allOnPageSelected = filteredByBrand.length > 0 && filteredByBrand.every((p) => selected.has(p.id));

  function bulkHideSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Hide ${ids.length} product(s) from the customer storefront?\n\nYou can unhide them later.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await setProductsStorefrontHidden(ids, true);
      if (result.ok) {
        setSelected(new Set());
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  function bulkUnhideSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = window.confirm(`Unhide ${ids.length} product(s) and show them to customers again?`);
    if (!ok) return;
    startTransition(async () => {
      const result = await setProductsStorefrontHidden(ids, false);
      if (result.ok) {
        setSelected(new Set());
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === "all"
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange"
            }`}
          >
            All ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("visible")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === "visible"
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange"
            }`}
          >
            Visible ({products.filter((p) => !p.storefront_hidden).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("hidden")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === "hidden"
                ? "border-rose-700 bg-rose-700 text-white"
                : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange"
            }`}
          >
            Hidden ({products.filter((p) => Boolean(p.storefront_hidden)).length})
          </button>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setBrand("__ALL__")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              brand === "__ALL__"
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange"
            }`}
          >
            All brands
          </button>
          {brandOptions.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrand(b)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                brand === b
                  ? "border-brand-orange bg-brand-orange/15 text-brand-navy"
                  : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange"
              }`}
            >
              {b}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBrand("__UNKNOWN__")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              brand === "__UNKNOWN__"
                ? "border-slate-700 bg-slate-700 text-white"
                : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange"
            }`}
          >
            Unknown
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-brand-navy/60">Selected: {selectedCount}</span>
          <button
            type="button"
            disabled={pending || selectedCount === 0}
            onClick={bulkUnhideSelected}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            Unhide selected
          </button>
          <button
            type="button"
            disabled={pending || selectedCount === 0}
            onClick={bulkHideSelected}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
          >
            Hide selected
          </button>
        </div>
      </div>

      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
          <tr>
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                aria-label="Select all visible rows"
              />
            </th>
            <th className="px-4 py-3 w-16"></th>
            <th className="px-4 py-3 w-40"></th>
            <th className="px-4 py-3">PRODUCT</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 w-28">Hidden at</th>
            <th className="px-4 py-3 w-32">Stock</th>
            <th className="px-4 py-3 w-28">Status</th>
            <th className="px-4 py-3 w-36"></th>
          </tr>
        </thead>
        <tbody>
          {filteredByBrand.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                No products found for this filter.
              </td>
            </tr>
          ) : (
            filteredByBrand.map((p) => {
              const low = p.stock_quantity <= lowStockThreshold;
              return (
                <StockRowEditor
                  key={p.id}
                  product={p}
                  low={low}
                  lowStockThreshold={lowStockThreshold}
                  pending={pending}
                  message={message?.id === p.id ? message : null}
                  hiddenMessage={hiddenMessage?.id === p.id ? hiddenMessage : null}
                  onSave={saveRow}
                  onToggleHidden={toggleHidden}
                  selected={selected.has(p.id)}
                  onSelect={toggleSelected}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function StockRowEditor({
  product,
  low,
  lowStockThreshold,
  pending,
  message,
  hiddenMessage,
  onSave,
  onToggleHidden,
  selected,
  onSelect,
}: {
  product: StockRow;
  low: boolean;
  lowStockThreshold: number;
  pending: boolean;
  message: { text: string; ok: boolean } | null;
  hiddenMessage: { text: string; ok: boolean } | null;
  onSave: (id: string, value: string) => void;
  onToggleHidden: (id: string, nextHidden: boolean) => void;
  selected: boolean;
  onSelect: (id: string, on: boolean) => void;
}) {
  const [value, setValue] = useState(String(product.stock_quantity));
  const [imageExpanded, setImageExpanded] = useState(false);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/80">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(product.id, e.target.checked)}
          aria-label={`Select ${product.name}`}
        />
      </td>
      <td className={`px-4 py-3 ${imageExpanded ? "align-top" : ""}`}>
        {product.imageUrl ? (
          <button
            type="button"
            className={`group block ${imageExpanded ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            onClick={() => setImageExpanded((v) => !v)}
            aria-pressed={imageExpanded}
            aria-label={imageExpanded ? "Show smaller product image" : "Show larger product image"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl}
              alt=""
              className={`rounded-md border border-slate-200 bg-white object-contain transition-[width,height,box-shadow] duration-200 ease-out group-hover:shadow-sm ${
                imageExpanded
                  ? "h-44 w-44 max-h-[min(50vh,18rem)] max-w-[min(85vw,18rem)] sm:h-52 sm:w-52"
                  : "h-10 w-10"
              }`}
              loading="lazy"
              decoding="async"
            />
          </button>
        ) : (
          <div className="h-10 w-10 rounded-md border border-dashed border-slate-200 bg-slate-50" />
        )}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => onToggleHidden(product.id, !(product.storefront_hidden ?? false))}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            product.storefront_hidden
              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {product.storefront_hidden ? "Show" : "Hide"}
        </button>
        {hiddenMessage ? (
          <span className={`ml-2 text-xs ${hiddenMessage.ok ? "text-green-700" : "text-red-600"}`}>
            {hiddenMessage.text}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 font-semibold text-brand-navy">{product.name}</td>
      <td className="px-4 py-3 text-slate-600">{product.category ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {product.storefront_hidden ? (product.storefront_hidden_at ? product.storefront_hidden_at.slice(0, 10) : "—") : "—"}
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 font-mono text-sm"
          disabled={pending}
        />
      </td>
      <td className="px-4 py-3">
        {low ? (
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            Low (≤{lowStockThreshold})
          </span>
        ) : (
          <span className="text-xs text-slate-500">OK</span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSave(product.id, value)}
          className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-navy/90 disabled:opacity-50"
        >
          Save
        </button>
        {message && (
          <span className={`ml-2 text-xs ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</span>
        )}
      </td>
    </tr>
  );
}

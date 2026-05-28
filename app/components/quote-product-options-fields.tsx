"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { ProductColourSwatchDots } from "@/app/components/product-colour-swatch";
import { QuoteProductAutocomplete } from "@/app/components/quote-product-autocomplete";
import { QuoteProductLineImage } from "@/app/components/quote-product-line-image";
import { useQuoteQuantity } from "@/app/components/quote-quantity-context";
import { findQuoteCatalogProduct, type QuoteCatalogProduct } from "@/lib/quote-catalog-products";

export type QuoteProductLine = {
  productId: string | null;
  spec: string;
  color: string;
  quantity: number;
};

type RowState = QuoteProductLine & {
  id: string;
};

type Props = {
  catalog: QuoteCatalogProduct[];
  initialLines?: QuoteProductLine[];
};

function normalizeLineQuantity(raw: number): number {
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.trunc(raw);
}

function quoteFieldLabelClassName(extra = "") {
  return `text-center text-sm font-semibold text-brand-navy ${extra}`.trim();
}

const quoteProductRowControlClassName =
  "box-border h-11 min-h-11 max-h-11 w-full min-w-0 rounded-md border border-brand-navy/20 px-3 text-sm leading-[1.45] text-brand-navy";

const quoteProductRowQuantityClassName = [
  quoteProductRowControlClassName,
  "text-center",
  "[appearance:textfield]",
  "[&::-webkit-outer-spin-button]:appearance-none",
  "[&::-webkit-inner-spin-button]:appearance-none",
].join(" ");

export function QuoteProductOptionsFields({ catalog, initialLines }: Props) {
  const { setTotalQuantity } = useQuoteQuantity();
  const rowIdPrefix = useId();
  const nextRowIdRef = useRef(initialLines?.length ? initialLines.length : 1);
  const [rows, setRows] = useState<RowState[]>(() =>
    (initialLines?.length ? initialLines : [{ productId: null, spec: "", color: "", quantity: 1 }]).map(
      (line, index) => ({
        id: `${rowIdPrefix}-${index}`,
        productId: line.productId ?? null,
        spec: line.spec,
        color: line.color ?? "",
        quantity: normalizeLineQuantity(line.quantity),
      }),
    ),
  );

  const totalQuantity = useMemo(
    () => rows.reduce((sum, row) => sum + normalizeLineQuantity(row.quantity), 0),
    [rows],
  );

  useEffect(() => {
    setTotalQuantity(totalQuantity);
  }, [setTotalQuantity, totalQuantity]);

  function updateRow(id: string, patch: Partial<QuoteProductLine>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const id = `${rowIdPrefix}-${nextRowIdRef.current++}`;
    setRows((prev) => [...prev, { id, productId: null, spec: "", color: "", quantity: 1 }]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  }

  return (
    <div className="grid min-w-0 gap-3 rounded-lg border border-brand-navy/15 p-4">
      <div>
        <p className="text-sm font-semibold text-brand-navy">Products</p>
        <p className="mt-1 text-sm text-brand-navy/60">
          Start typing a <strong>product name</strong>, <strong>Product ID</strong> (e.g. 7PIP, ZH145),{" "}
          <strong>slug</strong>, or <strong>UUID</strong> to search the catalog. Choose a colour for each product, then
          set quantities. Add more lines with <strong>Add Product</strong>.
        </p>
      </div>

      <div className="grid gap-3">
        {rows.map((row, index) => {
          const selectedProduct = findQuoteCatalogProduct(catalog, row.productId);
          const colorOptions = selectedProduct?.availableColors ?? [];

          return (
            <div
              key={row.id}
              className="grid min-w-0 grid-cols-[9rem_minmax(0,1fr)] gap-3 rounded-lg border border-brand-navy/10 bg-brand-surface/20 p-3 lg:grid-cols-[9rem_minmax(0,32rem)_minmax(8rem,1fr)_4.5rem_auto]"
            >
              <QuoteProductLineImage
                product={selectedProduct}
                color={row.color}
                labelId={`product_line_img_${row.id}`}
              />

              <div className="grid min-w-0 gap-1">
                <label htmlFor={`product_line_spec_${row.id}`} className={quoteFieldLabelClassName()}>
                  Product Name or ID{rows.length > 1 ? ` (${index + 1})` : ""}
                </label>
                <QuoteProductAutocomplete
                  id={`product_line_spec_${row.id}`}
                  inputName="product_line_spec"
                  hiddenIdName="product_line_id"
                  catalog={catalog}
                  productId={row.productId}
                  spec={row.spec}
                  onChange={({ productId, spec }) =>
                    updateRow(row.id, {
                      productId,
                      spec,
                      color: productId === row.productId ? row.color : "",
                    })
                  }
                  placeholder="Search name, Product ID (e.g. 7PIP), slug, or UUID"
                  className="min-w-0 w-full rounded-md border border-brand-navy/20 px-3 py-2 text-sm text-brand-navy"
                />
              </div>

              <div className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_4.5rem_auto] gap-3 lg:col-span-1 lg:contents">
                <div className="grid min-w-0 gap-1">
                  <label htmlFor={`product_line_color_${row.id}`} className={quoteFieldLabelClassName()}>
                    Colour
                  </label>
                  <div className="relative min-w-0">
                    <select
                      id={`product_line_color_${row.id}`}
                      name="product_line_color"
                      value={row.color}
                      disabled={!selectedProduct || colorOptions.length === 0}
                      onChange={(e) => updateRow(row.id, { color: e.target.value })}
                      className={`${quoteProductRowControlClassName} appearance-none bg-white pr-8 disabled:cursor-not-allowed disabled:bg-brand-surface/40 disabled:text-brand-navy/45`}
                    >
                      {!selectedProduct ? (
                        <option value="">Select a product first</option>
                      ) : colorOptions.length === 0 ? (
                        <option value="">No colours listed</option>
                      ) : (
                        <>
                          <option value="">Select colour</option>
                          {colorOptions.map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {row.color ? (
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                        <ProductColourSwatchDots label={row.color} compact />
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid w-full max-w-[4.5rem] shrink-0 gap-1">
                  <label htmlFor={`product_line_quantity_${row.id}`} className={quoteFieldLabelClassName()}>
                    Quantity
                  </label>
                  <input
                    id={`product_line_quantity_${row.id}`}
                    name="product_line_quantity"
                    type="number"
                    min={1}
                    step={1}
                    value={row.quantity}
                    onChange={(e) =>
                      updateRow(row.id, { quantity: normalizeLineQuantity(Number(e.target.value)) })
                    }
                    className={quoteProductRowQuantityClassName}
                  />
                </div>

                <div className="flex items-end">
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded-md border border-brand-navy/20 px-3 py-2 text-xs font-semibold text-brand-navy/70 hover:bg-brand-navy/5"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="hidden lg:block" aria-hidden />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-dashed border-brand-navy/30 px-4 py-2 text-sm font-semibold text-brand-navy hover:border-brand-orange hover:bg-brand-orange/5"
      >
        + Add Product
      </button>

      <div className="grid max-w-xs gap-1 border-t border-brand-navy/10 pt-4">
        <label htmlFor="quantity" className={quoteFieldLabelClassName()}>
          Total Quantity
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          readOnly
          value={totalQuantity}
          className="rounded-md border border-brand-navy/20 bg-brand-surface/40 px-3 py-2 text-sm font-semibold text-brand-navy"
        />
        <p className="text-xs text-brand-navy/60">
          Sum of all product quantities. Submit is enabled when total is 50 units or more.
        </p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";

import {
  createClearanceStockItem,
  deleteClearanceStockItem,
  updateClearanceStockItem,
} from "./actions";

export type ClearanceStockRow = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price_label: string;
  quantity: number | null;
  product_slug: string | null;
  image_url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

const inputClass =
  "mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

function PublishedSelect({ name, defaultValue }: { name: string; defaultValue: boolean }) {
  return (
    <select name={name} defaultValue={defaultValue ? "true" : "false"} className={inputClass}>
      <option value="true">Published</option>
      <option value="false">Draft</option>
    </select>
  );
}

type Props = {
  rows: ClearanceStockRow[];
};

export function ClearanceStockTable({ rows }: Props) {
  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Add line</h2>
        <p className="mt-1 text-sm text-slate-600">
          이벤트·클리어런스 페이지에 올릴 항목을 직접 입력합니다. 재고 수량은 비우면 &ldquo;수량 미표기&rdquo;로
          둘 수 있습니다.
        </p>
        <form action={createClearanceStockItem} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="new-title">
              Title <span className="text-red-600">*</span>
            </label>
            <input id="new-title" name="title" required className={inputClass} placeholder="예: Biz Care polo — Navy M" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="new-subtitle">
              Subtitle
            </label>
            <input id="new-subtitle" name="subtitle" className={inputClass} placeholder="한 줄 요약" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="new-description">
              Description
            </label>
            <textarea id="new-description" name="description" rows={3} className={inputClass} placeholder="상세 문구" />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-price">
              Price label
            </label>
            <input id="new-price" name="price_label" className={inputClass} placeholder="예: $39 · Was $65" />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-qty">
              Quantity (optional)
            </label>
            <input id="new-qty" name="quantity" type="number" min={0} step={1} className={inputClass} placeholder="비우면 미표기" />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-slug">
              Product slug (optional)
            </label>
            <input id="new-slug" name="product_slug" className={inputClass} placeholder="스토어 /products/… 슬러그" />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-image">
              Image URL (optional)
            </label>
            <input id="new-image" name="image_url" type="url" className={inputClass} placeholder="https://…" />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-sort">
              Sort order
            </label>
            <input id="new-sort" name="sort_order" type="number" step={1} defaultValue={0} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-published">
              Status
            </label>
            <PublishedSelect name="is_published" defaultValue />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95"
            >
              Add line
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Saved lines ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">아직 항목이 없습니다. 위에서 첫 줄을 추가하세요.</p>
        ) : (
          <ul className="mt-6 space-y-8">
            {rows.map((r) => (
              <li key={r.id} className="border-b border-slate-100 pb-8 last:border-0 last:pb-0">
                <form className="space-y-4">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <p className="text-xs text-slate-500">
                      ID <span className="font-mono">{r.id}</span>
                      <span className="mx-2">·</span>
                      Updated {new Date(r.updated_at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        formAction={updateClearanceStockItem}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                      >
                        Save changes
                      </button>
                      <button
                        type="submit"
                        formAction={deleteClearanceStockItem}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Title</label>
                      <input name="title" required defaultValue={r.title} className={inputClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Subtitle</label>
                      <input name="subtitle" defaultValue={r.subtitle} className={inputClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Description</label>
                      <textarea name="description" rows={3} defaultValue={r.description} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Price label</label>
                      <input name="price_label" defaultValue={r.price_label} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Quantity (blank = hide)</label>
                      <input
                        name="quantity"
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={r.quantity === null ? "" : r.quantity}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Product slug</label>
                      <input name="product_slug" defaultValue={r.product_slug ?? ""} className={inputClass} />
                      {r.product_slug ? (
                        <Link
                          href={`/products/${encodeURIComponent(r.product_slug)}`}
                          className="mt-1 inline-block text-xs font-semibold text-brand-orange hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open product →
                        </Link>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>Image URL</label>
                      <input name="image_url" type="url" defaultValue={r.image_url ?? ""} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Sort order</label>
                      <input name="sort_order" type="number" step={1} defaultValue={r.sort_order} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Status</label>
                      <PublishedSelect name="is_published" defaultValue={r.is_published} />
                    </div>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

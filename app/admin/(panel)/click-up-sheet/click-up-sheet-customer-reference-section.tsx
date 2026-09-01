"use client";

import { useEffect, useState } from "react";

import {
  deleteOrderProductionAsset,
  listCustomerReferenceVisualsForStoreOrderNumber,
  setCustomerMasterCompanyLogoFromOrderAsset,
  type CustomerReferenceVisualDto,
} from "./actions";
import {
  ClickUpSheetShowHideBody,
  ClickUpSheetShowHideHeading,
  useClickUpSheetShowHide,
} from "./click-up-sheet-show-hide";

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

type Props = {
  customerOrderId: string;
  initialItems: CustomerReferenceVisualDto[];
};

export function ClickUpSheetCustomerReferenceSection({ customerOrderId, initialItems }: Props) {
  const showHide = useClickUpSheetShowHide();
  const [items, setItems] = useState<CustomerReferenceVisualDto[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  useEffect(() => {
    const id = customerOrderId.trim();
    if (!id) {
      const t = window.setTimeout(() => {
        setItems([]);
        setError(null);
      }, 0);
      return () => window.clearTimeout(t);
    }

    let cancelled = false;
    const debounce = window.setTimeout(() => {
      void listCustomerReferenceVisualsForStoreOrderNumber(id).then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setError(null);
        setItems(r.items);
      });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [customerOrderId]);

  async function toggleMasterFromAsset(row: CustomerReferenceVisualDto, enabled: boolean) {
    const orderNumber = customerOrderId.trim();
    const storageBucket = String(row.storage_bucket ?? "").trim();
    const storagePath = String(row.storage_path ?? "").trim();
    if (!orderNumber || !storageBucket || !storagePath) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await setCustomerMasterCompanyLogoFromOrderAsset({
        orderNumber,
        storageBucket,
        storagePath,
        enabled,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.storage_bucket && it.storage_path
            ? {
                ...it,
                is_master_logo:
                  enabled ? it.storage_bucket === storageBucket && it.storage_path === storagePath : false,
              }
            : it,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  async function deleteAsset(row: CustomerReferenceVisualDto) {
    const orderNumber = customerOrderId.trim();
    const assetId = row.key.startsWith("prod:") ? row.key.slice("prod:".length) : "";
    if (!orderNumber || !assetId) {
      return;
    }
    if (!window.confirm("Delete this order asset? This cannot be undone.")) {
      return;
    }
    setDeletingKey(row.key);
    setError(null);
    try {
      const res = await deleteOrderProductionAsset({ orderNumber, assetId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setItems((prev) => prev.filter((it) => it.key !== row.key));
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
      <ClickUpSheetShowHideHeading
        title="Order assets (checkout / production)"
        open={showHide.open}
        onToggle={showHide.toggle}
      />
      <ClickUpSheetShowHideBody open={showHide.open}>
      <p className="click-up-sheet-print-hide mt-1 text-xs text-slate-600">
        이 주문(<span className="font-mono">store_orders</span>)에 연결된{" "}
        <span className="font-mono">production_order_assets</span> 전체, 체크아웃 라인의{" "}
        <span className="font-mono">placements</span>·<span className="font-mono">notes</span> 안의 이미지/PDF URL입니다.
        읽기 전용입니다. 시트에 직접 올릴 참고 사진은 아래 <strong>Reference images</strong>에서 추가하고, 생산 mock-up은{" "}
        <strong>Mock-up designs</strong>에서 업로드합니다.
      </p>
      {error ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {!customerOrderId.trim() ? (
        <p className="click-up-sheet-print-hide mt-4 text-sm text-slate-500">
          Order ID(스토어 주문 번호)를 입력하면 고객 참고 파일이 표시됩니다.
        </p>
      ) : items.length === 0 ? (
        <p className="click-up-sheet-print-hide mt-4 text-sm text-slate-500">
          이 주문에 연결된 고객 참고 파일이 없습니다.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((row) => (
            <li
              key={row.key}
              className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm"
            >
              {row.key.startsWith("prod:") && !row.is_master_logo ? (
                <button
                  type="button"
                  onClick={() => void deleteAsset(row)}
                  disabled={deletingKey === row.key}
                  aria-label="Delete this order asset"
                  title="Delete"
                  className="absolute right-1.5 top-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-sm font-bold text-slate-600 shadow hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingKey === row.key ? "…" : "\u00d7"}
                </button>
              ) : null}
              {isPdfUrl(row.public_url) ? (
                <div className="flex h-44 flex-col items-center justify-center gap-2 bg-white px-3 text-center">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">PDF</span>
                  <span className="line-clamp-2 text-xs text-slate-600">{row.caption}</span>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={row.public_url}
                  alt=""
                  className="h-44 w-full bg-white object-contain"
                  loading="lazy"
                />
              )}
              <div className="border-t border-slate-100 bg-slate-50 px-2 py-1.5">
                <p className="line-clamp-2 text-[0.65rem] text-slate-600">{row.caption}</p>
                {!isPdfUrl(row.public_url) && row.storage_bucket && row.storage_path ? (
                  <label className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-navy/80">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={Boolean(row.is_master_logo)}
                      disabled={pending}
                      onChange={(e) => void toggleMasterFromAsset(row, e.target.checked)}
                    />
                    Master logo
                  </label>
                ) : null}
                <a
                  href={row.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block truncate text-xs font-semibold text-brand-orange hover:underline"
                >
                  {isPdfUrl(row.public_url) ? "Open PDF" : "Open full size"}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      </ClickUpSheetShowHideBody>
    </section>
  );
}

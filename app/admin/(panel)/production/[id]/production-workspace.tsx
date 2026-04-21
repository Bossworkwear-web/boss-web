"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  listClickUpMockupsByStoreOrderNumber,
  type ClickUpSheetImageDto,
} from "@/app/admin/(panel)/click-up-sheet/actions";
import {
  deleteProductionAsset,
  listProductionAssets,
  uploadProductionAsset,
  type ProductionAssetDto,
} from "@/app/admin/(panel)/production/actions";
import { ImageUrlLightbox } from "@/app/components/image-url-lightbox";
import {
  mockupEmbroideryPrintingSummary,
  parseMockupDecorateMethodsJson,
} from "@/lib/click-up-sheet-mockup-methods";

const KIND_OPTIONS = [
  { id: "embroidery_logo", label: "Embroidery logo file" },
  { id: "printing_logo", label: "Printing logo file" },
] as const;

const IMAGE_NAME_RE = /\.(png|jpe?g|gif|webp|svg|bmp|heic|avif)$/i;

type KindId = (typeof KIND_OPTIONS)[number]["id"];

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

function isImageProductionAsset(a: ProductionAssetDto): boolean {
  const label = a.label?.trim();
  if (label && IMAGE_NAME_RE.test(label.toLowerCase())) {
    return true;
  }
  const tail = (a.storage_path.split("/").pop() ?? "").toLowerCase();
  return IMAGE_NAME_RE.test(tail);
}

function suggestedDownloadName(a: ProductionAssetDto): string {
  const base = a.storage_path.split("/").pop() || "file";
  const fromLabel = a.label?.trim();
  if (!fromLabel) {
    return base;
  }
  if (/\.[a-z0-9]{1,8}$/i.test(fromLabel)) {
    return fromLabel;
  }
  const extMatch = base.match(/(\.[a-z0-9]{1,8})$/i);
  return extMatch ? `${fromLabel}${extMatch[1]}` : fromLabel;
}

function isUserCancelledSavePicker(err: unknown): boolean {
  return (
    err instanceof DOMException
      ? err.name === "AbortError"
      : typeof err === "object" &&
          err !== null &&
          "name" in err &&
          (err as { name: string }).name === "AbortError"
  );
}

/**
 * When the browser supports the File System Access API, opens the system “Save as” dialog (Finder on macOS).
 * Otherwise falls back to a normal download into the default folder.
 */
async function downloadProductionFile(url: string, filename: string) {
  let blob: Blob;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("fetch failed");
    }
    blob = await res.blob();
  } catch {
    const el = document.createElement("a");
    el.href = url;
    el.download = filename;
    el.rel = "noopener noreferrer";
    document.body.appendChild(el);
    el.click();
    el.remove();
    return;
  }

  const win = window as Window & {
    showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<FileSystemFileHandle>;
  };
  if (typeof win.showSaveFilePicker === "function") {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: filename,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (isUserCancelledSavePicker(err)) {
        return;
      }
      /* e.g. transient activation or policy — fall through to programmatic download */
    }
  }

  const objUrl = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = objUrl;
  el.download = filename;
  document.body.appendChild(el);
  el.click();
  el.remove();
  URL.revokeObjectURL(objUrl);
}

export function ProductionWorkspace({
  orderId,
  orderNumber,
  completeOrdersDocumentsView = false,
}: {
  orderId: string;
  orderNumber: string;
  /** Complete Orders pre-process doc hub: no upload/delete. */
  completeOrdersDocumentsView?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [assets, setAssets] = useState<ProductionAssetDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mockupImages, setMockupImages] = useState<ClickUpSheetImageDto[]>([]);
  const [mockupsError, setMockupsError] = useState<string | null>(null);
  const [mockupLightboxSrc, setMockupLightboxSrc] = useState<string | null>(null);
  /** Which mock-up row shows file / sheet metadata (collapsed on screen to save space; always shown when printing). */
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const [kind, setKind] = useState<KindId>("embroidery_logo");
  const [label, setLabel] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const grouped = useMemo(() => {
    const by = new Map<string, ProductionAssetDto[]>();
    for (const a of assets) {
      const raw = (a.kind || "").trim();
      if (raw !== "embroidery_logo" && raw !== "printing_logo") {
        continue;
      }
      const list = by.get(raw) ?? [];
      list.push(a);
      by.set(raw, list);
    }
    return by;
  }, [assets]);

  async function reload() {
    const [res, mockRes] = await Promise.all([
      listProductionAssets(orderId),
      listClickUpMockupsByStoreOrderNumber(orderNumber),
    ]);
    if (!res.ok) {
      setLoadError(res.error);
      setAssets([]);
    } else {
      setLoadError(null);
      setAssets(res.assets);
    }
    if (!mockRes.ok) {
      setMockupsError(mockRes.error);
      setMockupImages([]);
    } else {
      setMockupsError(null);
      setMockupImages(mockRes.images);
    }
  }

  useEffect(() => {
    void reload();
  }, [orderId, orderNumber]);

  function onUpload() {
    if (completeOrdersDocumentsView || !file) return;
    setStatus({ ok: true, text: "Uploading…" });
    startTransition(async () => {
      const res = await uploadProductionAsset(orderId, kind, label, file);
      if (!res.ok) {
        setLoadError(res.error);
        setStatus({ ok: false, text: res.error });
        return;
      }
      setLoadError(null);
      setFile(null);
      setLabel("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await reload();
      setStatus({ ok: true, text: "Saved." });
    });
  }

  function onDelete(assetId: string) {
    if (completeOrdersDocumentsView) return;
    const ok = window.confirm("Delete this file? This cannot be undone.");
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteProductionAsset(assetId);
      if (!res.ok) {
        setLoadError(res.error);
        return;
      }
      setLoadError(null);
      await reload();
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <div>
        <h2 className="text-lg font-medium text-brand-navy">Production files</h2>
        <p className="mt-1 text-sm text-slate-600">
          Attach files to order <span className="font-mono font-semibold text-brand-navy">{orderNumber}</span>.
        </p>
      </div>

      {loadError ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 print:hidden">
          {loadError}
        </div>
      ) : null}
      {mockupsError ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 print:hidden">
          Mock-ups: {mockupsError}
        </div>
      ) : null}
      {status ? (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm print:hidden ${
            status.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {status.text}
        </div>
      ) : null}

      {completeOrdersDocumentsView ? (
        <p className="mt-5 text-sm text-slate-600 print:hidden">
          Complete Orders 문서 보기 모드: 생산 파일을 추가·삭제할 수 없습니다.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 print:hidden">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Type</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as KindId)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Label (optional)</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="e.g. Final logo v3 / Left chest"
                maxLength={140}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
              ref={fileInputRef}
            />
            <button
              type="button"
              disabled={pending || !file}
              onClick={onUpload}
              className="rounded-xl bg-brand-orange px-4 py-2 text-xs font-semibold text-brand-navy transition hover:brightness-95 disabled:opacity-50"
            >
              {pending ? "Uploading…" : "Add / Upload"}
            </button>
            {file ? <span className="text-xs text-slate-600">{file.name}</span> : null}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {KIND_OPTIONS.map((k) => {
          const list = grouped.get(k.id) ?? [];
          return (
            <div key={k.id} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">{k.label}</h3>

              {list.length === 0 ? (
                <p className="text-sm text-slate-500">—</p>
              ) : (
                <ul className="grid gap-2">
                  {list.map((a) => {
                    const showImg = isImageProductionAsset(a);
                    return (
                      <li
                        key={a.id}
                        className={`flex gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 ${
                          showImg ? "items-stretch" : "flex-wrap items-center justify-between"
                        }`}
                      >
                        {showImg ? (
                          <span className="production-pack-print-1x-thumb inline-block shrink-0">
                            <a
                              href={a.public_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative block h-28 w-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={a.public_url}
                                alt=""
                                className="h-full w-full object-contain"
                                loading="lazy"
                              />
                            </a>
                          </span>
                        ) : null}
                        <div
                          className={`min-w-0 flex-1 ${showImg ? "flex flex-col justify-center gap-1" : ""}`}
                        >
                          <a
                            href={a.public_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`block truncate text-sm font-semibold text-brand-orange hover:underline ${
                              showImg ? "max-w-full" : ""
                            }`}
                          >
                            {a.label?.trim() ? a.label.trim() : a.storage_path.split("/").pop()}
                          </a>
                          <p className="text-xs text-slate-500">{a.created_at.slice(0, 10)}</p>
                        </div>
                        <div
                          className={`flex items-center gap-2 print:hidden ${showImg ? "shrink-0 self-center" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => void downloadProductionFile(a.public_url, suggestedDownloadName(a))}
                            className="rounded-lg border border-brand-navy/20 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy hover:border-brand-orange hover:text-brand-orange"
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            disabled={completeOrdersDocumentsView || pending}
                            onClick={() => onDelete(a.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">Mock-up designs</h3>
          <p className="text-xs text-slate-600 print:hidden">
            Saved on{" "}
            <Link href="/admin/click-up-sheet" className="font-semibold text-brand-orange hover:underline">
              Click up sheet
            </Link>{" "}
            (Mock-up designs) for this order ID. Read-only here — add or remove files on that page.
          </p>
          {mockupImages.length === 0 && !mockupsError ? (
            <p className="text-sm text-slate-500">No mock-up files linked to this order yet.</p>
          ) : mockupImages.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
              {mockupImages.map((img) => {
                const pdf = isPdfUrl(img.public_url);
                const decorateLabels = parseMockupDecorateMethodsJson(img.mockup_decorate_methods);
                const decorateSummary = mockupEmbroideryPrintingSummary(decorateLabels);
                return (
                  <li
                    key={img.id}
                    className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3"
                  >
                    {!pdf ? (
                      <button
                        type="button"
                        onClick={() => setMockupLightboxSrc(img.public_url)}
                        className="relative aspect-square w-full max-w-full cursor-zoom-in overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2"
                        aria-label="View mock-up larger"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.public_url}
                          alt=""
                          className="pointer-events-none h-full w-full object-contain"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div className="flex aspect-square w-full max-w-full flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-center">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">PDF</span>
                        <span className="mt-1 text-xs font-semibold text-brand-navy">Mock-up</span>
                      </div>
                    )}
                    <p className="w-full text-center text-sm font-semibold text-brand-navy">{decorateSummary}</p>
                    {img.mockup_memo?.trim() ? (
                      <div className="w-full rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-2 text-left">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Memo</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{img.mockup_memo.trim()}</p>
                      </div>
                    ) : null}
                    <div className="flex w-full flex-col items-center gap-1 print:hidden">
                      {pdf ? (
                        <a
                          href={img.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-brand-orange hover:underline"
                        >
                          Open PDF
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMockupLightboxSrc(img.public_url)}
                          className="text-sm font-semibold text-brand-orange hover:underline"
                        >
                          View larger
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <ImageUrlLightbox
            open={Boolean(mockupLightboxSrc)}
            onClose={() => setMockupLightboxSrc(null)}
            src={mockupLightboxSrc ?? ""}
            ariaLabel="Full size mock-up image"
          />
        </div>
      </div>
    </section>
  );
}


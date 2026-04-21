"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { ImageUrlLightbox } from "@/app/components/image-url-lightbox";
import { parseMockupDecorateMethodsJson } from "@/lib/click-up-sheet-mockup-methods";
import {
  deleteClickUpSheetImage,
  listClickUpSheetImages,
  uploadClickUpSheetImage,
  type ClickUpSheetImageDto,
  type ClickUpSheetImageFilter,
} from "./actions";
import {
  ClickUpSheetMockupBuilderModal,
  type MockupBuilderEditTarget,
  type MockupPngReadyOptions,
} from "./click-up-sheet-mockup-builder-modal";

const ACCEPT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function mockupDecorateMethodChipClass(label: string): string {
  switch (label) {
    case "Embroidery":
      return "bg-blue-100 text-blue-800";
    case "DTF/HTV":
      return "bg-red-100 text-red-800";
    case "Sublimation":
      return "bg-green-100 text-green-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function looksLikeReferenceImageFile(f: File): boolean {
  const t = (f.type || "").toLowerCase();
  if (ACCEPT_IMAGE_TYPES.has(t)) {
    return true;
  }
  if (t) {
    return false;
  }
  return /\.(jpe?g|png|gif|webp)$/i.test(f.name || "");
}

function collectReferenceImageFilesFromDataTransfer(dt: DataTransfer): File[] {
  const out: File[] = [];
  if (dt.items?.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (item?.kind !== "file") {
        continue;
      }
      const f = item.getAsFile();
      if (f && looksLikeReferenceImageFile(f)) {
        out.push(f);
      }
    }
  } else if (dt.files?.length) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files[i];
      if (f && looksLikeReferenceImageFile(f)) {
        out.push(f);
      }
    }
  }
  return out;
}

type Props = {
  listDateYmd: string;
  customerOrderId: string;
  initialImages?: ClickUpSheetImageDto[];
  /** Mock-up: images + PDF (workers see these by order #). Reference: images only. */
  variant: "mockup" | "reference";
  /** Complete Orders pre-process doc hub: no upload/delete/mock-up builder. */
  readOnly?: boolean;
};

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

export function ClickUpSheetImagesSection({
  listDateYmd,
  customerOrderId,
  initialImages = [],
  variant,
  readOnly = false,
}: Props) {
  const isMockup = variant === "mockup";
  const assetFilter: ClickUpSheetImageFilter = isMockup ? "mockup" : "reference";
  const [images, setImages] = useState<ClickUpSheetImageDto[]>(() => initialImages ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);
  const [mockupBuilderOpen, setMockupBuilderOpen] = useState(false);
  const [mockupEditTarget, setMockupEditTarget] = useState<MockupBuilderEditTarget | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    const ld = listDateYmd.trim();
    if (!ld) {
      return;
    }

    let cancelled = false;

    const t = window.setTimeout(() => {
      void listClickUpSheetImages(ld, customerOrderId.trim(), assetFilter).then((r) => {
        if (!cancelled && r.ok) {
          setImages(r.images);
        }
      });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [listDateYmd, customerOrderId, assetFilter]);

  function closeMockupBuilder() {
    setMockupBuilderOpen(false);
    setMockupEditTarget(null);
  }

  async function uploadOneMockupFile(
    file: File,
    mockupDecorateMethods?: string[],
    mockupMemo?: string,
  ): Promise<{ ok: true; image: ClickUpSheetImageDto } | { ok: false; error: string }> {
    const fd = new FormData();
    fd.set("list_date", listDateYmd.trim());
    fd.set("customer_order_id", customerOrderId.trim());
    fd.set("is_mockup", "true");
    fd.set("file", file);
    if (mockupDecorateMethods !== undefined) {
      fd.set("mockup_decorate_methods", JSON.stringify(mockupDecorateMethods));
    }
    fd.set("mockup_memo", mockupMemo ?? "");
    return uploadClickUpSheetImage(fd);
  }

  function handleMockupPngReady(file: File, decorateMethods: string[], options?: MockupPngReadyOptions) {
    if (readOnly) {
      return;
    }
    if (!listDateYmd.trim()) {
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        const memoNormalized = (options?.mockupMemo ?? "").trim().slice(0, 2000);
        const memoForRow: string | null = memoNormalized.length > 0 ? memoNormalized : null;
        const result = await uploadOneMockupFile(file, decorateMethods, memoNormalized);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const imageRow: ClickUpSheetImageDto = {
          ...result.image,
          mockup_memo: memoForRow,
        };
        const replaceId = options?.replaceImageId;
        if (replaceId) {
          const del = await deleteClickUpSheetImage(replaceId);
          if (del.ok) {
            setImages((prev) => {
              const rest = prev.filter((i) => i.id !== replaceId);
              return [...rest, imageRow].sort((a, b) => a.sort_order - b.sort_order);
            });
          } else {
            setError(`New mock-up was saved, but the previous file could not be removed: ${del.error}`);
            setImages((prev) => [...prev, imageRow].sort((a, b) => a.sort_order - b.sort_order));
          }
        } else {
          setImages((prev) => [...prev, imageRow]);
        }
      })();
    });
  }

  function uploadFilesList(files: File[], mockupDecorateMethods?: string[]) {
    if (readOnly) {
      return;
    }
    if (!files.length || !listDateYmd.trim()) {
      return;
    }
    setError(null);

    startTransition(() => {
      void (async () => {
        for (const file of files) {
          const fd = new FormData();
          fd.set("list_date", listDateYmd.trim());
          fd.set("customer_order_id", customerOrderId.trim());
          fd.set("is_mockup", isMockup ? "true" : "false");
          fd.set("file", file);
          if (isMockup && mockupDecorateMethods !== undefined) {
            fd.set("mockup_decorate_methods", JSON.stringify(mockupDecorateMethods));
          }
          const result = await uploadClickUpSheetImage(fd);
          if (!result.ok) {
            setError(result.error);
            break;
          }
          setImages((prev) => [...prev, result.image]);
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      })();
    });
  }

  function onFilesSelected(files: FileList | null) {
    uploadFilesList(files ? Array.from(files) : []);
  }

  function onDropZoneDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setDragActive(true);
  }

  function onDropZoneDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragActive(false);
    }
  }

  function onDropZoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDropZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    const files = collectReferenceImageFilesFromDataTransfer(e.dataTransfer);
    if (files.length === 0) {
      setError("Drop JPEG, PNG, GIF, or WebP files only.");
      return;
    }
    setError(null);
    uploadFilesList(files);
  }

  function removeImage(id: string) {
    if (readOnly) {
      return;
    }
    if (!window.confirm("Delete this file?")) {
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        const result = await deleteClickUpSheetImage(id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setImages((prev) => prev.filter((i) => i.id !== id));
      })();
    });
  }

  const title = isMockup ? "Mock-up designs" : "Reference images";
  const helpSql = (
    <span className="font-mono">supabase/sql-editor/click_up_sheet_images_full_setup.sql</span>
  );

  if (!listDateYmd.trim()) {
    return (
      <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm print:bg-white print:shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">워크시트 날짜가 있을 때만 파일을 저장할 수 있습니다.</p>
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <p className="mt-1 text-xs text-slate-600 print:hidden">
        {isMockup ? (
          <>
            Production mock-ups (JPEG / PNG / GIF / WebP / PDF). Same Perth date and <strong>Order ID</strong> as the
            sheet. Workers open <strong>Warehouse → Order mock-ups</strong> with the store order number to view these
            files. Run migrations <span className="font-mono">20260446_click_up_sheet_images_mockup.sql</span>,{" "}
            <span className="font-mono">20260447_click_up_sheet_images_mockup_methods.sql</span>, and{" "}
            <span className="font-mono">20260459_click_up_sheet_images_mockup_memo.sql</span> (or{" "}
            <span className="font-mono">supabase/sql-editor/patch_click_up_sheet_images_mockup_memo.sql</span>) if uploads
            fail with <span className="font-mono">is_mockup</span> / <span className="font-mono">mockup_decorate_methods</span> /{" "}
            <span className="font-mono">mockup_memo</span> column or schema cache errors.
          </>
        ) : (
          <>
            Extra reference photos (images only, up to 12MB each). Production mock-ups go in{" "}
            <strong>Mock-up designs</strong> at the bottom of this page. First-time setup: {helpSql} (table + bucket{" "}
            <span className="font-mono">click-up-sheet-images</span>).
          </>
        )}
      </p>
      {error ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {readOnly ? (
        <div className="mt-4 space-y-3 print:hidden">
          <p className="text-sm text-slate-600">
            Complete Orders 문서 보기 모드: 이미지를 추가·삭제할 수 없습니다.
          </p>
          {!isMockup ? (
            <div
              className="flex min-h-[10rem] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center text-slate-500"
              aria-hidden
            >
              <p className="text-base font-semibold tracking-tight text-slate-500">{"Drag & Attach"}</p>
              <p className="mt-2 max-w-md text-sm">이 모드에서는 파일을 끌어 넣을 수 없습니다.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3 print:hidden">
          {isMockup ? (
            <>
              <ClickUpSheetMockupBuilderModal
                open={mockupBuilderOpen}
                onClose={closeMockupBuilder}
                editTarget={mockupEditTarget}
                customerOrderId={customerOrderId}
                listDateYmd={listDateYmd}
                pendingUpload={pending}
                onPngReady={(file, methods, opts) => handleMockupPngReady(file, methods, opts)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || !listDateYmd.trim() || !customerOrderId.trim()}
                  onClick={() => {
                    setMockupEditTarget(null);
                    setMockupBuilderOpen(true);
                  }}
                  className="rounded-lg border border-brand-navy bg-brand-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    !listDateYmd.trim() || !customerOrderId.trim()
                      ? "Perth worksheet date and Order ID are required."
                      : undefined
                  }
                >
                  Add mock-up
                </button>
              </div>
            </>
          ) : null}
          {!isMockup ? (
            <>
              <div
                role="region"
                aria-label="Drag and attach reference images"
                onDragEnter={onDropZoneDragEnter}
                onDragLeave={onDropZoneDragLeave}
                onDragOver={onDropZoneDragOver}
                onDrop={onDropZoneDrop}
                className={`flex min-h-[10rem] flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
                  pending ? "pointer-events-none opacity-60" : ""
                } ${
                  dragActive
                    ? "border-brand-orange bg-brand-orange/10 ring-2 ring-brand-orange/25"
                    : "border-slate-300 bg-slate-50/80 hover:border-brand-navy/35 hover:bg-slate-50"
                }`}
              >
                <p className="text-base font-semibold tracking-tight text-brand-navy">{"Drag & Attach"}</p>
                <p className="mt-2 max-w-md text-sm text-slate-600">
                  Drop reference images here, or use <strong className="text-slate-800">Add images (browse)</strong>{" "}
                  below.
                </p>
                <p className="mt-1 text-xs text-slate-500">JPEG, PNG, GIF, or WebP · multiple files · up to 12MB each</p>
              </div>
              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    disabled={pending}
                    className="sr-only"
                    onChange={(e) => onFilesSelected(e.target.files)}
                  />
                  {pending ? "Uploading…" : "Add images (browse)"}
                </label>
              </div>
            </>
          ) : null}
        </div>
      )}
      {images.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          {isMockup ? "No mock-up files yet. Set Order ID, then use Add mock-up." : "No reference images yet."}
        </p>
      ) : (
        <ul
          className={
            isMockup
              ? "click-up-sheet-print-image-grid mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          }
        >
          {images.map((img) => {
            const decorateLabels = isMockup ? parseMockupDecorateMethodsJson(img.mockup_decorate_methods) : [];
            return (
            <li
              key={img.id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm"
            >
              {isPdfUrl(img.public_url) ? (
                <div
                  className={`flex flex-col items-center justify-center gap-2 bg-white px-3 text-center ${
                    isMockup ? "min-h-[33rem] h-[33rem]" : "h-44"
                  }`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">PDF</span>
                  <span className="text-xs font-semibold text-brand-navy">Mock-up document</span>
                </div>
              ) : isMockup ? (
                <button
                  type="button"
                  className="block w-full cursor-zoom-in bg-white p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2"
                  onClick={() => setLightboxSrc(img.public_url)}
                  aria-label="View mock-up larger"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.public_url}
                    alt=""
                    className="pointer-events-none h-[33rem] min-h-[33rem] w-full bg-white object-contain"
                    loading="lazy"
                  />
                </button>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={img.public_url}
                  alt=""
                  className={`w-full bg-white object-contain ${isMockup ? "min-h-[33rem] h-[33rem]" : "h-44"}`}
                  loading="lazy"
                />
              )}
              {decorateLabels.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 bg-white px-2 py-3 text-center">
                  {decorateLabels.map((m) => (
                    <span
                      key={m}
                      className={`rounded-md px-3 py-1 text-[1.3rem] font-semibold leading-tight ${mockupDecorateMethodChipClass(m)}`}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              ) : null}
              {isMockup && img.mockup_memo?.trim() ? (
                <div className="border-t border-slate-100 bg-white px-3 py-2 text-left">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Memo</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{img.mockup_memo.trim()}</p>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-2 py-1.5 print:hidden">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  {isPdfUrl(img.public_url) ? (
                    <a
                      href={img.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs font-semibold text-brand-orange hover:underline"
                    >
                      Open PDF
                    </a>
                  ) : isMockup ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setLightboxSrc(img.public_url)}
                        className="truncate text-left text-xs font-semibold text-brand-orange hover:underline"
                      >
                        View larger
                      </button>
                      {!readOnly ? (
                        <button
                          type="button"
                          disabled={pending || !listDateYmd.trim() || !customerOrderId.trim()}
                          onClick={() => {
                            setMockupEditTarget({
                              imageId: img.id,
                              publicUrl: img.public_url,
                              decorateMethods: decorateLabels,
                              memo: img.mockup_memo ?? null,
                            });
                            setMockupBuilderOpen(true);
                          }}
                          className="shrink-0 text-xs font-semibold text-brand-navy hover:underline disabled:opacity-50"
                        >
                          Edit
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <a
                      href={img.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs font-semibold text-brand-orange hover:underline"
                    >
                      Open full size
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  disabled={readOnly || pending}
                  onClick={() => removeImage(img.id)}
                  className="shrink-0 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      )}
      <ImageUrlLightbox
        open={Boolean(lightboxSrc)}
        onClose={() => setLightboxSrc(null)}
        src={lightboxSrc ?? ""}
        ariaLabel="Full size mock-up image"
      />
    </section>
  );
}

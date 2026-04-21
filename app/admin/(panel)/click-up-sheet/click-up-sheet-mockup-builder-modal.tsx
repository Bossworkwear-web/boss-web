"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MOCKUP_DECORATE_METHOD_OPTIONS } from "@/lib/click-up-sheet-mockup-methods";

import {
  listClickUpSheetImages,
  listCustomerReferenceVisualsForStoreOrderNumber,
  type CustomerReferenceVisualDto,
} from "./actions";

const CATEGORIES = ["TEE", "Vest", "Polo", "Shirt", "Jacket"] as const;
type Category = (typeof CATEGORIES)[number];

type Step = "gallery" | "compose";

function emptyTemplatesByCategory(): Record<Category, string[]> {
  return { TEE: [], Vest: [], Polo: [], Shirt: [], Jacket: [] };
}

function templateFileLabel(url: string): string {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const n = u.searchParams.get("name");
    return n ? decodeURIComponent(n) : url;
  } catch {
    return url;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (typeof window !== "undefined") {
      try {
        const abs = new URL(src, window.location.origin);
        if (abs.origin !== window.location.origin) {
          im.crossOrigin = "anonymous";
        }
      } catch {
        // relative URL — keep default (credentials for same-origin)
      }
    }
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Image failed to load"));
    im.src = src;
  });
}

/** Avoid canvas taint when the logo is on another host (e.g. Supabase storage). */
async function loadImageViaFetch(src: string): Promise<HTMLImageElement> {
  const r = await fetch(src);
  if (!r.ok) {
    throw new Error("Could not load logo");
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

type Layout = {
  ox: number;
  oy: number;
  dw: number;
  dh: number;
  cw: number;
  ch: number;
};

function computeObjectContainLayout(cw: number, ch: number, nw: number, nh: number): Layout {
  const ir = nw / nh;
  const cr = cw / ch;
  let dw: number;
  let dh: number;
  let ox: number;
  let oy: number;
  if (ir > cr) {
    dw = cw;
    dh = cw / ir;
    ox = 0;
    oy = (ch - dh) / 2;
  } else {
    dh = ch;
    dw = ch * ir;
    ox = (cw - dw) / 2;
    oy = 0;
  }
  return { ox, oy, dw, dh, cw, ch };
}

type DecoratePick = Record<(typeof MOCKUP_DECORATE_METHOD_OPTIONS)[number], boolean>;

function emptyDecoratePick(): DecoratePick {
  return { Embroidery: false, "DTF/HTV": false, Sublimation: false };
}

function decoratePickFromLabels(labels: string[]): DecoratePick {
  for (const label of MOCKUP_DECORATE_METHOD_OPTIONS) {
    if (labels.includes(label)) {
      return { ...emptyDecoratePick(), [label]: true };
    }
  }
  return emptyDecoratePick();
}

export type MockupBuilderEditTarget = {
  imageId: string;
  publicUrl: string;
  decorateMethods: string[];
  memo: string | null;
};

export type MockupPngReadyOptions = {
  replaceImageId?: string;
  mockupMemo?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  customerOrderId: string;
  listDateYmd: string;
  onPngReady: (file: File, decorateMethods: string[], options?: MockupPngReadyOptions) => void;
  pendingUpload: boolean;
  /** Open compose step with this image as the garment/base (replace row after save). */
  editTarget?: MockupBuilderEditTarget | null;
};

export function ClickUpSheetMockupBuilderModal({
  open,
  onClose,
  customerOrderId,
  listDateYmd,
  onPngReady,
  pendingUpload,
  editTarget = null,
}: Props) {
  const [step, setStep] = useState<Step>("gallery");
  const [category, setCategory] = useState<Category | null>(null);
  const [templatesByCategory, setTemplatesByCategory] = useState<Record<Category, string[]>>(
    emptyTemplatesByCategory,
  );
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);

  const [logos, setLogos] = useState<CustomerReferenceVisualDto[]>([]);
  const [logosLoading, setLogosLoading] = useState(false);
  const [selectedLogoUrl, setSelectedLogoUrl] = useState<string | null>(null);

  const [u, setU] = useState(0.5);
  const [v, setV] = useState(0.38);
  const [logoWidthFrac, setLogoWidthFrac] = useState(0.22);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [baseImageError, setBaseImageError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [decoratePick, setDecoratePick] = useState<DecoratePick>(() => emptyDecoratePick());
  const [memo, setMemo] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const bgImgRef = useRef<HTMLImageElement>(null);
  const draggingRef = useRef(false);
  const layoutRef = useRef<Layout | null>(null);
  layoutRef.current = layout;

  const measure = useCallback(() => {
    const img = bgImgRef.current;
    if (!img?.naturalWidth || !img.naturalHeight) {
      return;
    }
    const cw = img.clientWidth;
    const ch = img.clientHeight;
    if (cw < 2 || ch < 2) {
      return;
    }
    setLayout(computeObjectContainLayout(cw, ch, img.naturalWidth, img.naturalHeight));
  }, []);

  useLayoutEffect(() => {
    if (!open || step !== "compose" || !templateUrl) {
      return;
    }
    const img = bgImgRef.current;
    if (!img) {
      return;
    }
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(img);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open, step, templateUrl, measure]);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setGalleryLoading(false);
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      if (editTarget?.publicUrl) {
        setStep("compose");
        setCategory(null);
        setTemplatesByCategory(emptyTemplatesByCategory());
        setGalleryError(null);
        setTemplateUrl(editTarget.publicUrl);
        setSelectedLogoUrl(null);
        setExportError(null);
        setLayout(null);
        setBaseImageError(false);
        setDecoratePick(decoratePickFromLabels(editTarget.decorateMethods));
        setMemo((editTarget.memo ?? "").trim());
      } else {
        setStep("gallery");
        setCategory(null);
        setTemplatesByCategory(emptyTemplatesByCategory());
        setGalleryError(null);
        setTemplateUrl(null);
        setSelectedLogoUrl(null);
        setExportError(null);
        setLayout(null);
        setBaseImageError(false);
        setDecoratePick(emptyDecoratePick());
        setMemo("");
      }
    }
  }, [open, editTarget]);

  useEffect(() => {
    if (!open || step !== "gallery") {
      return;
    }
    let cancelled = false;
    setGalleryLoading(true);
    setGalleryError(null);
    void (async () => {
      const rows = await Promise.all(
        CATEGORIES.map(async (cat) => {
          try {
            const r = await fetch(`/api/admin/mock-up-templates?category=${encodeURIComponent(cat)}`, {
              credentials: "same-origin",
            });
            if (!r.ok) {
              return [cat, []] as const;
            }
            const data = (await r.json()) as { urls: string[] };
            return [cat, data.urls ?? []] as const;
          } catch {
            return [cat, []] as const;
          }
        }),
      );
      if (cancelled) {
        return;
      }
      const next = emptyTemplatesByCategory();
      for (const [cat, urls] of rows) {
        next[cat] = [...urls];
      }
      setTemplatesByCategory(next);
      const total = CATEGORIES.reduce((sum, c) => sum + next[c].length, 0);
      if (total === 0) {
        setGalleryError(
          "public/Mock_up 아래 TEE, Vest, Polo, Shirt, Jacket 폴더에 PNG·JPEG·WebP·SVG 등 이미지가 있는지 확인하세요.",
        );
      } else {
        setGalleryError(null);
      }
      if (!cancelled) {
        setGalleryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step]);

  useEffect(() => {
    if (!open || step !== "compose") {
      return;
    }
    const id = customerOrderId.trim();
    const listDate = listDateYmd.trim();
    let cancelled = false;
    setLogosLoading(true);

    void (async () => {
      const [custRes, sheetRes] = await Promise.all([
        id ? listCustomerReferenceVisualsForStoreOrderNumber(id) : Promise.resolve({ ok: true as const, items: [] }),
        listDate
          ? listClickUpSheetImages(listDate, id, "reference")
          : Promise.resolve({ ok: true as const, images: [] }),
      ]);

      if (cancelled) {
        return;
      }

      const customerRows: CustomerReferenceVisualDto[] =
        custRes.ok ? custRes.items.filter((x) => !isPdfUrl(x.public_url)) : [];

      const sheetRows: CustomerReferenceVisualDto[] = sheetRes.ok
        ? sheetRes.images
            .filter((img) => !isPdfUrl(img.public_url))
            .map((img) => {
              const tail = img.storage_path.split("/").pop() ?? img.id;
              return {
                key: `sheet-ref:${img.id}`,
                public_url: img.public_url,
                caption: `Click Up sheet · reference · ${tail}`,
              };
            })
        : [];

      const seen = new Set<string>();
      const merged: CustomerReferenceVisualDto[] = [];
      for (const row of [...sheetRows, ...customerRows]) {
        const u = row.public_url;
        if (seen.has(u)) {
          continue;
        }
        seen.add(u);
        merged.push(row);
      }

      setLogos(merged);
      setSelectedLogoUrl((prev) => {
        if (prev && merged.some((i) => i.public_url === prev)) {
          return prev;
        }
        return merged[0]?.public_url ?? null;
      });
      setLogosLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, step, customerOrderId, listDateYmd]);

  function clientToUV(clientX: number, clientY: number): { u: number; v: number } {
    const img = bgImgRef.current;
    const L = layoutRef.current;
    if (!img || !L) {
      return { u: 0.5, v: 0.5 };
    }
    const rect = img.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const nu = (px - L.ox) / L.dw;
    const nv = (py - L.oy) / L.dh;
    return { u: clamp(nu, 0, 1), v: clamp(nv, 0, 1) };
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) {
        return;
      }
      const { u: nu, v: nv } = clientToUV(e.clientX, e.clientY);
      setU(nu);
      setV(nv);
    }
    function onUp() {
      draggingRef.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  async function exportPng() {
    if (!templateUrl || !selectedLogoUrl) {
      setExportError("Select a logo.");
      return;
    }
    setExportError(null);
    setExporting(true);
    try {
      const bg = await loadImageViaFetch(templateUrl);
      const logo = await loadImageViaFetch(selectedLogoUrl);
      const canvas = document.createElement("canvas");
      canvas.width = bg.naturalWidth;
      canvas.height = bg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas not supported");
      }
      ctx.drawImage(bg, 0, 0);
      const lw = bg.naturalWidth * logoWidthFrac;
      const lh = (logo.naturalHeight / logo.naturalWidth) * lw;
      const cx = u * bg.naturalWidth;
      const cy = v * bg.naturalHeight;
      ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
      if (!blob) {
        throw new Error("Could not build PNG.");
      }
      const cat = category ?? "mockup";
      const file = new File([blob], `mockup-${cat}-${Date.now()}.png`, { type: "image/png" });
      const decorateMethods = MOCKUP_DECORATE_METHOD_OPTIONS.filter((m) => decoratePick[m]);
      const memoTrim = memo.trim().slice(0, 2000);
      onPngReady(file, decorateMethods, {
        mockupMemo: memoTrim,
        ...(editTarget ? { replaceImageId: editTarget.imageId } : {}),
      });
      onClose();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (!open || typeof document === "undefined") {
    return null;
  }

  const dialog = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mockup-builder-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="max-h-[min(92vh,900px)] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="mockup-builder-title" className="text-lg font-semibold text-brand-navy">
              {editTarget ? "Edit mock-up" : "Add mock-up"}
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              {editTarget ? (
                <>
                  현재 목업 이미지를 베이스로 로고 위치·크기와 장식 방식을 조정한 뒤 저장하면 새 파일로 갱신됩니다.
                </>
              ) : (
                <>
                  <span className="font-mono">public/Mock_up/TEE</span> 등 폴더의 템플릿을 고른 뒤, 이 시트의{" "}
                  <strong>Reference images</strong> 또는 주문 연동 로고를 올려 맞추고 PNG로 저장합니다.
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4">
          {step === "gallery" ? (
            <div className="space-y-8">
              <div>
                <p className="text-sm font-semibold text-slate-800">템플릿 선택</p>
                <p className="mt-1 text-xs text-slate-600">
                  각 옷 종류 폴더(<span className="font-mono">public/Mock_up/TEE</span> …)에 넣은 이미지가 아래에 표시됩니다.
                </p>
              </div>
              {galleryLoading ? (
                <p className="text-sm text-slate-500">템플릿 목록을 불러오는 중…</p>
              ) : galleryError ? (
                <p className="text-sm text-amber-800">{galleryError}</p>
              ) : null}
              {CATEGORIES.map((cat) => {
                const urls = templatesByCategory[cat] ?? [];
                return (
                  <section key={cat} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {cat}{" "}
                      <span className="font-normal normal-case text-slate-400">
                        · <span className="font-mono">/Mock_up/{cat}/</span>
                      </span>
                    </h3>
                    {urls.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">이 폴더에 표시할 이미지가 없습니다.</p>
                    ) : (
                      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {urls.map((url) => (
                          <li key={url}>
                            <button
                              type="button"
                              onClick={() => {
                                setBaseImageError(false);
                                setCategory(cat);
                                setTemplateUrl(url);
                                setStep("compose");
                              }}
                              className="flex w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:border-brand-orange"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="h-28 w-full object-contain" loading="lazy" />
                              <span className="truncate border-t border-slate-100 px-1.5 py-1 text-[0.65rem] text-slate-600">
                                {templateFileLabel(url)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          ) : null}

          {step === "compose" && templateUrl ? (
            <div className="space-y-4">
              {!editTarget ? (
                <button
                  type="button"
                  onClick={() => {
                    setStep("gallery");
                    setTemplateUrl(null);
                    setCategory(null);
                    setLayout(null);
                    setBaseImageError(false);
                  }}
                  className="text-xs font-semibold text-brand-orange hover:underline"
                >
                  ← 템플릿 목록으로
                </button>
              ) : null}

              <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-slate-100 p-2">
                {baseImageError ? (
                  <p className="px-3 py-16 text-center text-sm text-red-700">
                    베이스 이미지를 불러오지 못했습니다. URL:{" "}
                    <span className="break-all font-mono text-xs">{templateUrl}</span>
                  </p>
                ) : (
                  <div
                    ref={containerRef}
                    className="relative mx-auto inline-block max-w-full select-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={bgImgRef}
                      src={templateUrl}
                      alt=""
                      className="relative z-0 block h-auto max-h-[min(70vh,560px)] max-w-full object-contain"
                    onLoad={() => {
                      setBaseImageError(false);
                      measure();
                      requestAnimationFrame(() => measure());
                    }}
                      onError={() => setBaseImageError(true)}
                      draggable={false}
                    />
                    {selectedLogoUrl && layout ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={selectedLogoUrl}
                        alt=""
                        draggable={false}
                        className="pointer-events-auto absolute z-10 cursor-move touch-none"
                        style={{
                          left: layout.ox + u * layout.dw,
                          top: layout.oy + v * layout.dh,
                          width: layout.dw * logoWidthFrac,
                          height: "auto",
                          transform: "translate(-50%, -50%)",
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          draggingRef.current = true;
                          const uv = clientToUV(e.clientX, e.clientY);
                          setU(uv.u);
                          setV(uv.v);
                        }}
                      />
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600" htmlFor="logo-scale-range">
                  Logo size (relative to garment width)
                </label>
                <input
                  id="logo-scale-range"
                  type="range"
                  min={0.08}
                  max={0.55}
                  step={0.01}
                  value={logoWidthFrac}
                  onChange={(e) => setLogoWidthFrac(Number(e.target.value))}
                  className="mt-1 block w-full"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-600">
                  Logo (sheet Reference images · checkout / production assets)
                </p>
                {logosLoading ? (
                  <p className="mt-2 text-sm text-slate-500">Loading logos…</p>
                ) : logos.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    사용할 이미지가 없습니다. 이 페이지의 <strong>Reference images</strong>에서 시트용 참고 사진을
                    업로드하거나, 주문에 연결된 에셋이 있는지 확인하세요. 워크시트 날짜가 있어야 시트 참고 이미지가
                    불러와집니다.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {logos.map((row) => (
                      <li key={row.key}>
                        <button
                          type="button"
                          onClick={() => setSelectedLogoUrl(row.public_url)}
                          className={`overflow-hidden rounded-lg border-2 bg-white p-0.5 ${
                            selectedLogoUrl === row.public_url
                              ? "border-brand-orange"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={row.public_url} alt="" className="h-14 w-14 object-contain" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {exportError ? (
                <p className="text-sm text-red-700" role="alert">
                  {exportError}
                </p>
              ) : null}

              <fieldset className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
                <legend className="px-1 text-xs font-semibold text-slate-700">Decorate method (optional)</legend>
                <p className="mt-1 text-[0.65rem] text-slate-500">
                  저장 시 목업과 함께 기록됩니다. 세 가지 중 <strong>하나만</strong> 선택할 수 있습니다. 같은 항목을 다시
                  누르면 선택이 해제됩니다.
                </p>
                <ul className="mt-2 flex flex-wrap gap-3">
                  {MOCKUP_DECORATE_METHOD_OPTIONS.map((label) => (
                    <li key={label}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          checked={decoratePick[label]}
                          onChange={() =>
                            setDecoratePick((p) => {
                              if (p[label]) {
                                return emptyDecoratePick();
                              }
                              return { ...emptyDecoratePick(), [label]: true };
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-brand-orange focus:ring-brand-orange"
                        />
                        <span>{label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>

              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
                <label htmlFor="mockup-compose-memo" className="text-xs font-semibold text-slate-700">
                    MEMO
                  </label>
                  <p className="mt-1 text-[0.65rem] text-slate-500">
                    생산·창고 참고용 메모입니다. 저장 시 목업과 함께 기록됩니다.
                  </p>
                <textarea
                  id="mockup-compose-memo"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value.slice(0, 2000))}
                    rows={4}
                    placeholder="예: 로고 위치 확정, 색상 확인 요청 등"
                    className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-brand-orange/50 focus:outline-none focus:ring-2 focus:ring-brand-orange/25"
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={exporting || pendingUpload || !listDateYmd.trim() || !customerOrderId.trim()}
                  onClick={() => void exportPng()}
                  className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exporting || pendingUpload ? "Working…" : "Save PNG to mock-ups"}
                </button>
                <p className="text-xs text-slate-500">
                  워크시트 날짜·Order ID가 있어야 업로드됩니다. 저장 후 아래 목록이 갱신됩니다.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

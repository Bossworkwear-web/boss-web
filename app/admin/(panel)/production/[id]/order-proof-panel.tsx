"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { ClickUpSheetImageDto } from "@/app/admin/(panel)/click-up-sheet/actions";
import {
  listOrderProofs,
  sendOrderProofForApproval,
  uploadProofLogoImage,
} from "@/app/admin/(panel)/production/proof-actions";
import { ImageUrlLightbox } from "@/app/components/image-url-lightbox";
import {
  proofStatusLabel,
  type OrderProofRecord,
  type OrderProofStatus,
} from "@/lib/order-proof";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Parse the mock-up's decorate methods JSON (e.g. `["Embroidery","DTF/HTV"]`) into a display string. */
function decorateMethodLabel(raw: string | null): string {
  if (!raw) return "";
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr.map((m) => String(m).trim()).filter(Boolean).join(" / ");
    }
  } catch {
    // fall through to raw string
  }
  return raw.trim();
}

function statusBadgeClass(status: OrderProofStatus): string {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "declined":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-amber-200 bg-amber-50 text-amber-900";
  }
}

export function OrderProofPanel({
  orderId,
  orderNumber = "",
  mockupImages,
  initialProofs,
}: {
  orderId: string;
  orderNumber?: string;
  mockupImages: ClickUpSheetImageDto[];
  initialProofs: OrderProofRecord[];
}) {
  const [proofs, setProofs] = useState<OrderProofRecord[]>(initialProofs);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(mockupImages.map((m) => [m.public_url, true])),
  );
  /** Local order of the mock-ups so staff can drag to reorder how they appear in the proof email. */
  const [orderedMockups, setOrderedMockups] = useState<ClickUpSheetImageDto[]>(mockupImages);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setOrderedMockups(mockupImages);
  }, [mockupImages]);

  function moveMockup(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setOrderedMockups((prev) => {
      if (from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  /** Externally-produced embroidery/print logo images, sent ahead of the mock-ups. */
  const [logoUrls, setLogoUrls] = useState<string[]>([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const selectedUrls = useMemo(
    () => orderedMockups.map((m) => m.public_url).filter((u) => selected[u]),
    [orderedMockups, selected],
  );

  // Logo artwork first, then the selected mock-ups — the order the customer sees in the email.
  const outgoingUrls = useMemo(() => [...logoUrls, ...selectedUrls], [logoUrls, selectedUrls]);

  const latest = proofs[0] ?? null;

  function reload() {
    void listOrderProofs(orderId).then((res) => {
      if (res.ok) setProofs(res.proofs);
    });
  }

  async function onPickLogo(file: File) {
    setStatus(null);
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("order_number", orderNumber);
      const res = await uploadProofLogoImage(fd);
      if (!res.ok) {
        setStatus({ ok: false, text: res.error });
        return;
      }
      setLogoUrls((prev) => (prev.includes(res.url) ? prev : [...prev, res.url]));
    } catch {
      setStatus({ ok: false, text: "Logo upload failed." });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  function removeLogo(url: string) {
    setLogoUrls((prev) => prev.filter((u) => u !== url));
  }

  function onSend() {
    if (selectedUrls.length === 0 && logoUrls.length === 0) {
      setStatus({ ok: false, text: "Upload a logo image or select at least one mock-up to send." });
      return;
    }
    setStatus({ ok: true, text: "Sending…" });
    const metaByUrl = new Map(
      mockupImages.map((m) => [
        m.public_url,
        { method: decorateMethodLabel(m.mockup_decorate_methods), memo: (m.mockup_memo ?? "").trim() },
      ]),
    );
    const mockups = selectedUrls.map((url) => {
      const meta = metaByUrl.get(url) ?? { method: "", memo: "" };
      return { url, method: meta.method, memo: meta.memo };
    });
    startTransition(async () => {
      const res = await sendOrderProofForApproval({
        storeOrderId: orderId,
        mockups,
        embroideryPreviews: logoUrls,
        note,
      });
      if (!res.ok) {
        setStatus({ ok: false, text: res.error });
        return;
      }
      setNote("");
      setLogoUrls([]);
      setStatus({ ok: true, text: `Proof sent to the customer (round ${res.round}).` });
      reload();
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-brand-navy">Customer proof approval</h2>
          <p className="mt-1 text-sm text-slate-600">
            Email the design proof (시안) to the customer and track their approval before production.
          </p>
        </div>
        {latest ? (
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(
              latest.status,
            )}`}
          >
            {proofStatusLabel(latest.status)} · round {latest.round}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            No proof sent yet
          </span>
        )}
      </div>

      {/* Compose new proof */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <p className="text-sm font-semibold text-brand-navy">
          {proofs.length > 0 ? "Send a revised proof" : "Send proof for approval"}
        </p>

        {/* Embroidery/print logo artwork (made in an external program) — sent first, before the mock-ups. */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-brand-navy">Embroidery / print logo image (sent first)</p>
          <p className="mt-1 text-xs text-slate-500">
            Upload artwork you produced in another program. It appears ahead of the mock-ups in the customer email.
          </p>

          {logoUrls.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {logoUrls.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo images are supabase public URLs */}
                  <img
                    src={url}
                    alt="Logo"
                    className="h-20 w-20 cursor-pointer rounded border border-brand-orange/40 object-contain p-1"
                    onClick={() => setLightboxSrc(url)}
                  />
                  <button
                    type="button"
                    onClick={() => removeLogo(url)}
                    className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-600 shadow hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove logo image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <label
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploadingLogo) setLogoDragOver(true);
            }}
            onDragLeave={() => setLogoDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setLogoDragOver(false);
              if (uploadingLogo) return;
              const files = Array.from(e.dataTransfer.files);
              const f = files.find((file) => file.type.startsWith("image/")) ?? files[0];
              if (f) void onPickLogo(f);
            }}
            className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
              logoDragOver
                ? "border-brand-orange bg-brand-orange/5"
                : "border-slate-300 bg-slate-50/60 hover:border-brand-orange/60"
            } ${uploadingLogo ? "opacity-60" : ""}`}
          >
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              disabled={uploadingLogo}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickLogo(f);
              }}
              className="hidden"
            />
            <span className="text-sm font-medium text-brand-navy">
              {uploadingLogo ? "Uploading…" : "Drag & drop logo image here"}
            </span>
            <span className="text-xs text-slate-500">
              or click to choose · PNG, JPEG, GIF, WebP (max 15&nbsp;MB)
            </span>
          </label>
        </div>

        {mockupImages.length === 0 ? (
          <p className="mt-3 text-sm text-amber-800">
            No mock-up images found for this order. Add mock-ups on the Click-up sheet to include them — or send just
            the logo image above.
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-slate-500">
              Choose the images to include. Drag a mock-up left or right to change its order in the email.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {orderedMockups.map((m, index) => {
                const checked = Boolean(selected[m.public_url]);
                const isDragOver = dragOverIndex === index;
                return (
                  <label
                    key={m.id}
                    draggable
                    onDragStart={() => {
                      dragIndexRef.current = index;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverIndex !== index) setDragOverIndex(index);
                    }}
                    onDragLeave={() => setDragOverIndex((cur) => (cur === index ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = dragIndexRef.current;
                      if (from != null) moveMockup(from, index);
                      dragIndexRef.current = null;
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      dragIndexRef.current = null;
                      setDragOverIndex(null);
                    }}
                    className={`group relative block cursor-move overflow-hidden rounded-lg border bg-white ${
                      isDragOver
                        ? "border-brand-orange ring-2 ring-brand-orange"
                        : checked
                          ? "border-brand-orange ring-2 ring-brand-orange/40"
                          : "border-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="absolute left-2 top-2 z-10 h-4 w-4 accent-brand-orange"
                      checked={checked}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [m.public_url]: e.target.checked }))
                      }
                    />
                    <span className="absolute right-2 top-2 z-10 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-navy/80 px-1 text-[0.7rem] font-bold text-white">
                      {index + 1}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element -- proof images are supabase public URLs, shown small in admin */}
                    <img
                      src={m.public_url}
                      alt="Mock-up"
                      className="aspect-square w-full object-contain p-1"
                      draggable={false}
                      onClick={(e) => {
                        e.preventDefault();
                        setLightboxSrc(m.public_url);
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Optional message to the customer (e.g. logo placement, thread colours)…"
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-orange focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSend}
            disabled={pending || outgoingUrls.length === 0}
            className="inline-flex items-center justify-center rounded-lg bg-brand-orange px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-navy shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Sending…" : proofs.length > 0 ? "Send revised proof" : "Send proof for approval"}
          </button>
          <span className="text-xs text-slate-500">
            {outgoingUrls.length} image{outgoingUrls.length === 1 ? "" : "s"} selected
            {logoUrls.length > 0 ? ` · ${logoUrls.length} logo${logoUrls.length === 1 ? "" : "s"} first` : ""}
          </span>
        </div>

        {status ? (
          <p className={`mt-2 text-sm ${status.ok ? "text-emerald-700" : "text-red-700"}`}>{status.text}</p>
        ) : null}
      </div>

      {/* History */}
      {proofs.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-brand-navy">Proof history</p>
          {proofs.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-brand-navy">Round {p.round}</span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                    p.status,
                  )}`}
                >
                  {proofStatusLabel(p.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Sent {formatDateTime(p.sentAt)} to {p.sentTo}
                {p.decidedAt ? ` · Decided ${formatDateTime(p.decidedAt)}` : ""}
              </p>
              {p.note ? <p className="mt-1 text-xs text-slate-600">Note: {p.note}</p> : null}
              {p.customerComment ? (
                <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                  Customer: {p.customerComment}
                </p>
              ) : null}
              {p.imageUrls.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.imageUrls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element -- proof images are supabase public URLs
                    <img
                      key={url}
                      src={url}
                      alt="Proof"
                      className="h-16 w-16 cursor-pointer rounded border border-slate-200 object-contain"
                      onClick={() => setLightboxSrc(url)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <ImageUrlLightbox
        open={Boolean(lightboxSrc)}
        src={lightboxSrc ?? ""}
        onClose={() => setLightboxSrc(null)}
        enlarged
      />
    </section>
  );
}

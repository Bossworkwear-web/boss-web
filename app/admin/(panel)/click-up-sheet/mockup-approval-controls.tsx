"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  deleteOrderProofRound,
  listOrderProofs,
  loadProofContextByOrderNumber,
  previewOrderProofEmail,
  sendOrderProofForApproval,
  uploadProofLogoImage,
} from "@/app/admin/(panel)/production/proof-actions";
import { ImageUrlLightbox } from "@/app/components/image-url-lightbox";
import { proofStatusLabel, type OrderProofRecord, type OrderProofStatus } from "@/lib/order-proof";

import { reorderClickUpSheetMockups } from "./actions";

export type ApprovalMockup = { id: string; url: string; method: string; memo: string };

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

/**
 * Customer proof approval, merged into the Mock-up designs section. The selectable/ordered mock-ups are owned
 * by the parent section (single grid); here we add the embroidery preview upload, optional message, the send
 * action, and the approval status/history. Resolves the store order UUID from the Customer Order ID.
 */
export function MockupApprovalControls({
  customerOrderId,
  mockups,
  orderedMockupIds,
}: {
  customerOrderId: string;
  mockups: ApprovalMockup[];
  /** Full display order of mock-ups (selected or not) — persisted to sort_order when a proof is sent. */
  orderedMockupIds: string[];
}) {
  const [storeOrderId, setStoreOrderId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [proofs, setProofs] = useState<OrderProofRecord[]>([]);

  const [logoUrls, setLogoUrls] = useState<string[]>([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deletingProofId, setDeletingProofId] = useState<string | null>(null);

  useEffect(() => {
    const num = customerOrderId.trim();
    if (!num) {
      setStoreOrderId(null);
      setProofs([]);
      setLoadState("idle");
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    const timer = window.setTimeout(() => {
      void loadProofContextByOrderNumber(num).then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setStoreOrderId(null);
          setProofs([]);
          setLoadState("error");
          setLoadError(res.error);
          return;
        }
        setStoreOrderId(res.storeOrderId);
        setProofs(res.proofs);
        setLoadState("ready");
        setLoadError(null);
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerOrderId]);

  const latest = proofs[0] ?? null;
  const outgoingCount = mockups.length + logoUrls.length;

  function reload() {
    if (!storeOrderId) return;
    void listOrderProofs(storeOrderId).then((res) => {
      if (res.ok) setProofs(res.proofs);
    });
  }

  function deleteProof(proof: OrderProofRecord) {
    if (!storeOrderId) return;
    if (
      !window.confirm(
        `Delete proof round ${proof.round}? This removes the history entry and any proof snapshot files for this round.`,
      )
    ) {
      return;
    }
    setStatus(null);
    setDeletingProofId(proof.id);
    startTransition(async () => {
      const res = await deleteOrderProofRound({ storeOrderId, proofId: proof.id });
      setDeletingProofId(null);
      if (!res.ok) {
        setStatus({ ok: false, text: res.error });
        return;
      }
      setProofs((prev) => prev.filter((p) => p.id !== proof.id));
      setStatus({ ok: true, text: `Proof round ${proof.round} deleted.` });
    });
  }

  async function onPickLogo(file: File) {
    setStatus(null);
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("order_number", customerOrderId.trim());
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

  async function onPreview() {
    if (!storeOrderId) {
      setStatus({ ok: false, text: "Enter a valid Customer Order ID first." });
      return;
    }
    setStatus(null);
    setPreviewLoading(true);
    try {
      const res = await previewOrderProofEmail({
        storeOrderId,
        mockups: mockups.map((m) => ({ url: m.url, method: m.method, memo: m.memo })),
        embroideryPreviews: logoUrls,
        note,
      });
      if (!res.ok) {
        setStatus({ ok: false, text: res.error });
        return;
      }
      setPreviewHtml(res.html);
    } catch {
      setStatus({ ok: false, text: "Could not build the email preview." });
    } finally {
      setPreviewLoading(false);
    }
  }

  function onSend() {
    if (!storeOrderId) {
      setStatus({ ok: false, text: "Enter a valid Customer Order ID first." });
      return;
    }
    if (outgoingCount === 0) {
      setStatus({ ok: false, text: "Select at least one mock-up or upload a preview image to send." });
      return;
    }
    setStatus({ ok: true, text: "Sending…" });
    startTransition(async () => {
      const res = await sendOrderProofForApproval({
        storeOrderId,
        mockups: mockups.map((m) => ({ url: m.url, method: m.method, memo: m.memo })),
        embroideryPreviews: logoUrls,
        note,
      });
      if (!res.ok) {
        setStatus({ ok: false, text: res.error });
        return;
      }
      // Persist the Mock-up designs reorder (drag order) at the same time the proof goes out.
      const saveOrder = await reorderClickUpSheetMockups(orderedMockupIds, customerOrderId);
      setNote("");
      setLogoUrls([]);
      setStatus({
        ok: true,
        text: saveOrder.ok
          ? `Proof sent to the customer (round ${res.round}). Mock-up order saved.`
          : `Proof sent (round ${res.round}), but saving the mock-up order failed: ${saveOrder.error}`,
      });
      reload();
    });
  }

  if (!customerOrderId.trim()) {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <p className="text-sm font-semibold text-brand-navy">Customer proof approval</p>
        <p className="mt-1 text-sm text-slate-600">
          Enter a Customer Order ID above to email the design proof (시안) for approval.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/60 p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-navy">Customer proof approval</p>
          <p className="mt-1 text-xs text-slate-600">
            Selected mock-ups above + any preview images below are emailed to the customer for approval.
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
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            No proof sent yet
          </span>
        )}
      </div>

      {loadState === "error" ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError ?? "Could not load this order."}
        </p>
      ) : null}

      {/* Embroidery / print preview artwork (made externally) — sent ahead of the mock-ups. */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-brand-navy">Embroidery / print preview image (sent first)</p>
        <p className="mt-1 text-xs text-slate-500">
          Upload artwork you produced in another program. It appears under “Embroidery Preview” in the customer email.
        </p>

        {logoUrls.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {logoUrls.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- supabase public URLs */}
                <img
                  src={url}
                  alt="Preview"
                  className="h-20 w-20 cursor-pointer rounded border border-brand-orange/40 object-contain p-1"
                  onClick={() => setLightboxSrc(url)}
                />
                <button
                  type="button"
                  onClick={() => removeLogo(url)}
                  className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-600 shadow hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove preview image"
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
            {uploadingLogo ? "Uploading…" : "Drag & drop preview image here"}
          </span>
          <span className="text-xs text-slate-500">or click to choose · PNG, JPEG, GIF, WebP (max 15&nbsp;MB)</span>
        </label>
      </div>

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
          disabled={pending || loadState === "loading" || outgoingCount === 0}
          className="inline-flex items-center justify-center rounded-lg bg-brand-orange px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-navy shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Sending…" : proofs.length > 0 ? "Send revised proof" : "Send proof for approval"}
        </button>
        <button
          type="button"
          onClick={() => void onPreview()}
          disabled={previewLoading || loadState === "loading" || !storeOrderId}
          className="inline-flex items-center justify-center rounded-lg border border-brand-navy bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-navy shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {previewLoading ? "Building…" : "Preview email"}
        </button>
        <span className="text-xs text-slate-500">
          {mockups.length} mock-up{mockups.length === 1 ? "" : "s"} selected
          {logoUrls.length > 0 ? ` · ${logoUrls.length} preview${logoUrls.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      {status ? (
        <p className={`mt-2 text-sm ${status.ok ? "text-emerald-700" : "text-red-700"}`}>{status.text}</p>
      ) : null}

      {proofs.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-brand-navy">Proof history</p>
          {proofs.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand-navy">Round {p.round}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                      p.status,
                    )}`}
                  >
                    {proofStatusLabel(p.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteProof(p)}
                    disabled={pending || deletingProofId === p.id}
                    aria-label={`Delete proof round ${p.round}`}
                    title="Delete this proof round"
                    className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingProofId === p.id ? "…" : "Delete"}
                  </button>
                </div>
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
                    // eslint-disable-next-line @next/next/no-img-element -- supabase public URLs
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

      {previewHtml != null ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Proof email preview"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="flex h-[1123px] max-h-[95vh] w-[794px] max-w-[95vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-brand-navy">Email preview</p>
                <p className="text-xs text-slate-500">
                  This is exactly what the customer receives. Approve link is disabled in the preview.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewHtml(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <iframe
              key={previewHtml}
              title="Proof email preview"
              sandbox=""
              srcDoc={previewHtml}
              className="w-full flex-1 bg-white"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

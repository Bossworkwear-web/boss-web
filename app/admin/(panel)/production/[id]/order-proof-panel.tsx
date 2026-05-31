"use client";

import { useMemo, useState, useTransition } from "react";

import type { ClickUpSheetImageDto } from "@/app/admin/(panel)/click-up-sheet/actions";
import {
  listOrderProofs,
  sendOrderProofForApproval,
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
  mockupImages,
  initialProofs,
}: {
  orderId: string;
  mockupImages: ClickUpSheetImageDto[];
  initialProofs: OrderProofRecord[];
}) {
  const [proofs, setProofs] = useState<OrderProofRecord[]>(initialProofs);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(mockupImages.map((m) => [m.public_url, true])),
  );
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const selectedUrls = useMemo(
    () => mockupImages.map((m) => m.public_url).filter((u) => selected[u]),
    [mockupImages, selected],
  );

  const latest = proofs[0] ?? null;

  function reload() {
    void listOrderProofs(orderId).then((res) => {
      if (res.ok) setProofs(res.proofs);
    });
  }

  function onSend() {
    if (selectedUrls.length === 0) {
      setStatus({ ok: false, text: "Select at least one proof image to send." });
      return;
    }
    setStatus({ ok: true, text: "Sending…" });
    startTransition(async () => {
      const res = await sendOrderProofForApproval({
        storeOrderId: orderId,
        imageUrls: selectedUrls,
        note,
      });
      if (!res.ok) {
        setStatus({ ok: false, text: res.error });
        return;
      }
      setNote("");
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

        {mockupImages.length === 0 ? (
          <p className="mt-2 text-sm text-amber-800">
            No mock-up images found for this order. Add mock-ups on the Click-up sheet first, then refresh.
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-slate-500">Choose the images to include:</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {mockupImages.map((m) => {
                const checked = Boolean(selected[m.public_url]);
                return (
                  <label
                    key={m.id}
                    className={`group relative block cursor-pointer overflow-hidden rounded-lg border bg-white ${
                      checked ? "border-brand-orange ring-2 ring-brand-orange/40" : "border-slate-200"
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- proof images are supabase public URLs, shown small in admin */}
                    <img
                      src={m.public_url}
                      alt="Mock-up"
                      className="aspect-square w-full object-contain p-1"
                      onClick={(e) => {
                        e.preventDefault();
                        setLightboxSrc(m.public_url);
                      }}
                    />
                  </label>
                );
              })}
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
                disabled={pending || selectedUrls.length === 0}
                className="inline-flex items-center justify-center rounded-lg bg-brand-orange px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-navy shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Sending…" : proofs.length > 0 ? "Send revised proof" : "Send proof for approval"}
              </button>
              <span className="text-xs text-slate-500">
                {selectedUrls.length} image{selectedUrls.length === 1 ? "" : "s"} selected
              </span>
            </div>
          </>
        )}

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

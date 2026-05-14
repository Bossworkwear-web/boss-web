"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { removeDispatchCarrierLabel, uploadDispatchCarrierLabel } from "./carrier-label-actions";

type Props = {
  queueId: string;
  orderNumber: string;
  carrierLabelImageUrls: readonly string[];
};

function isPdfUrl(url: string): boolean {
  const lower = url.split("?")[0]?.toLowerCase() ?? "";
  return lower.endsWith(".pdf");
}

export function DispatchCarrierLabelsCell({ queueId, orderNumber, carrierLabelImageUrls }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-w-[11rem] max-w-[16rem] space-y-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">AusPost / carrier label</p>
      <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-1.5">
        {carrierLabelImageUrls.length === 0 ? (
          <p className="px-1 py-2 text-[0.7rem] leading-snug text-slate-500">QR·바코드 라벨 이미지 또는 PDF</p>
        ) : (
          carrierLabelImageUrls.map((url) => (
            <div
              key={url}
              className="flex items-center gap-2 rounded-md bg-white p-1 shadow-sm ring-1 ring-slate-100"
            >
              {isPdfUrl(url) ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[0.65rem] font-semibold text-brand-orange underline"
                >
                  PDF
                </a>
              ) : (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-12 w-12 shrink-0 overflow-hidden rounded border border-slate-200 bg-white"
                  aria-label={`Label preview order ${orderNumber}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-contain" loading="lazy" />
                </a>
              )}
              <form
                className="ml-auto shrink-0"
                action={async (fd) => {
                  setError(null);
                  const r = await removeDispatchCarrierLabel(fd);
                  if (!r.ok) setError(r.error);
                  else router.refresh();
                }}
              >
                <input type="hidden" name="queue_id" value={queueId} />
                <input type="hidden" name="remove_url" value={url} />
                <button
                  type="submit"
                  className="rounded px-1.5 py-0.5 text-[0.65rem] font-medium text-red-600 hover:bg-red-50"
                  aria-label="Remove label"
                >
                  Remove
                </button>
              </form>
            </div>
          ))
        )}
      </div>

      <form
        className="space-y-1"
        action={async (fd) => {
          setError(null);
          const r = await uploadDispatchCarrierLabel(fd);
          if (!r.ok) setError(r.error);
          else router.refresh();
        }}
      >
        <input type="hidden" name="queue_id" value={queueId} />
        <label className="block">
          <span className="sr-only">Upload carrier label file</span>
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className="block w-full max-w-full cursor-pointer text-[0.7rem] file:mr-2 file:rounded file:border-0 file:bg-brand-orange file:px-2 file:py-1 file:text-[0.65rem] file:font-semibold file:text-brand-navy hover:file:brightness-95"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-slate-800 px-2 py-1.5 text-[0.7rem] font-semibold text-white transition hover:bg-slate-900"
        >
          Upload
        </button>
      </form>
      {error ? <p className="text-[0.65rem] leading-snug text-red-600">{error}</p> : null}
    </div>
  );
}

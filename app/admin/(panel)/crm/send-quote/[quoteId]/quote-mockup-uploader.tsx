"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { removeQuoteMockupImage, uploadQuoteMockupImages } from "../../actions";

export function QuoteMockupUploader({ quoteId, urls }: { quoteId: string; urls: string[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openPicker() {
    setError(null);
    setMessage(null);
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    e.target.value = "";
    if (!list?.length) return;

    const fd = new FormData();
    for (const f of list) {
      fd.append("files", f);
    }

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const r = await uploadQuoteMockupImages(quoteId, fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMessage(r.uploadedUrls.length ? `Uploaded ${r.uploadedUrls.length} image(s).` : "Saved.");
      router.refresh();
    });
  }

  function onRemove(url: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const r = await removeQuoteMockupImage(quoteId, url);
      if (!r.ok) {
        setError(r.error ?? "Remove failed");
        return;
      }
      setMessage("Image removed.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mockup images</p>
      <p className="mt-1 text-xs text-slate-600">
        Upload visuals to attach to this quote (JPG, PNG, WebP, or GIF — up to 8MB each, max 12 images). Files are
        stored in the same public bucket as customer logo uploads.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        multiple
        className="sr-only"
        onChange={onFileChange}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={openPicker}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-slate-100 disabled:opacity-50"
        >
          {pending ? "Working…" : "Upload mockups"}
        </button>
        <span className="text-[11px] text-slate-500">{urls.length} / 12</span>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {message}
        </p>
      ) : null}

      {urls.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {urls.map((url) => (
            <li key={url} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-only remote mockup URL */}
              <img src={url} alt="Mockup" className="aspect-square w-full object-cover" />
              <div className="flex flex-wrap gap-1 border-t border-slate-200 bg-white p-1.5">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded px-2 py-0.5 text-[10px] font-semibold text-brand-orange hover:underline"
                >
                  Open
                </a>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRemove(url)}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-slate-500">No mockups yet.</p>
      )}
    </section>
  );
}

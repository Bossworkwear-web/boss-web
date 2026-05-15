"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";

const MAX_BYTES = 12 * 1024 * 1024;

function storagePathFromPublicUrl(url: string): string | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base || !url.startsWith(base)) return null;
  const prefix = `${base}/storage/v1/object/public/production-order-assets/`;
  if (!url.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(url.slice(prefix.length));
  } catch {
    return url.slice(prefix.length);
  }
}

type Props = {
  quoteRequestId: string | null;
  imageUrls: string[];
  onImageUrlsChange: (urls: string[]) => void;
};

export function CustomerQuoteImageDropzone({ quoteRequestId, imageUrls, onImageUrlsChange }: Props) {
  const dragDepth = useRef(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.size > 0);
      if (list.length === 0) return;

      setError(null);
      setUploading(true);
      const nextUrls = [...imageUrls];

      try {
        for (const file of list) {
          if (!String(file.type ?? "").toLowerCase().startsWith("image/")) {
            setError("Only image files are allowed.");
            continue;
          }
          if (file.size > MAX_BYTES) {
            setError("One or more images exceed 12 MB.");
            continue;
          }

          const fd = new FormData();
          fd.set("file", file);
          if (quoteRequestId) {
            fd.set("quote_request_id", quoteRequestId);
          }

          const res = await fetch("/api/admin/customer-quote/images", {
            method: "POST",
            body: fd,
          });
          const json = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
          if (!res.ok || !json.ok || !json.url) {
            setError(json.error ?? "Upload failed.");
            continue;
          }
          nextUrls.push(json.url);
        }
        onImageUrlsChange(nextUrls);
      } finally {
        setUploading(false);
      }
    },
    [imageUrls, onImageUrlsChange, quoteRequestId],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      if (e.dataTransfer.files?.length) {
        void uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }, []);

  async function removeImage(url: string) {
    const storagePath = storagePathFromPublicUrl(url);
    if (storagePath) {
      try {
        await fetch("/api/admin/customer-quote/images", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath }),
        });
      } catch {
        // Best-effort; still remove from UI.
      }
    }
    onImageUrlsChange(imageUrls.filter((u) => u !== url));
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={uploading}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/jpeg,image/png,image/gif,image/webp";
          input.multiple = true;
          input.onchange = () => {
            if (input.files?.length) void uploadFiles(input.files);
          };
          input.click();
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        className={`flex min-h-[7.5rem] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center transition print:hidden ${
          dragOver
            ? "border-brand-orange bg-brand-orange/10 text-brand-navy"
            : "border-brand-navy/25 bg-brand-navy/[0.02] text-brand-navy/80 hover:border-brand-orange/50 hover:bg-brand-navy/[0.04]"
        } ${uploading ? "cursor-wait opacity-70" : ""}`}
      >
        <span className="text-sm font-semibold text-brand-navy">Drag &amp; save</span>
        <span className="text-xs text-brand-navy/65">
          Drop images here or click to browse · saved when uploaded · JPEG, PNG, GIF, WebP · max 12 MB each
        </span>
        {uploading ? <span className="text-xs font-medium text-brand-orange">Uploading…</span> : null}
      </button>

      {error ? <p className="text-sm text-red-700 print:hidden">{error}</p> : null}

      {imageUrls.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {imageUrls.map((url) => (
            <li key={url} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full object-contain bg-slate-50 p-1" />
              <button
                type="button"
                onClick={() => void removeImage(url)}
                className="absolute right-1 top-1 rounded-md bg-white/90 px-2 py-0.5 text-[0.65rem] font-semibold text-red-700 shadow print:hidden"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500 print:hidden">No images attached yet.</p>
      )}
    </div>
  );
}

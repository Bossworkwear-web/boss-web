"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT_ATTR = ".pdf,.ai,.png,application/pdf,image/png";
const ALLOWED_EXT = new Set(["pdf", "ai", "png"]);

function fileExtensionOk(file: File): boolean {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return ALLOWED_EXT.has(ext);
}

function fileExtension(file: File): string {
  return file.name.toLowerCase().split(".").pop() ?? "";
}

type QuoteLogoDropzoneProps = {
  inputId?: string;
  inputName?: string;
};

/**
 * Logo file field for Get a Quote — drag-and-drop or click; still a native file input for server action FormData.
 */
export function QuoteLogoDropzone({ inputId = "logo_file", inputName = "logo_file" }: QuoteLogoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const assignFile = useCallback((file: File | null) => {
    setError(null);
    const input = inputRef.current;
    if (!input) return;

    if (!file) {
      input.value = "";
      input.files = new DataTransfer().files;
      setFileName(null);
      setPreviewUrl(null);
      return;
    }

    if (!fileExtensionOk(file)) {
      setError("Only PDF, AI, or PNG files are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large. Maximum size is 10 MB.");
      return;
    }

    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    setFileName(file.name);

    const ext = fileExtension(file);
    const isRaster =
      ext === "png" || (typeof file.type === "string" && file.type.toLowerCase().startsWith("image/"));
    setPreviewUrl(isRaster ? URL.createObjectURL(file) : null);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) assignFile(f);
    },
    [assignFile],
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

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        id={inputId}
        name={inputName}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          assignFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        className={`flex min-h-[8.5rem] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver
            ? "border-brand-orange bg-brand-orange/10 text-brand-navy"
            : "border-brand-navy/25 bg-brand-navy/[0.02] text-brand-navy/80 hover:border-brand-orange/50 hover:bg-brand-navy/[0.04]"
        }`}
      >
        <span className="text-sm font-semibold text-brand-navy">Drag &amp; save</span>
        <span className="text-xs text-brand-navy/65">
          Drop your logo here or click to browse · PDF, AI, PNG · max 10 MB
        </span>
        {fileName ? (
          <span className="mt-1 max-w-full truncate rounded-md bg-white px-2 py-1 font-mono text-xs text-brand-navy ring-1 ring-brand-navy/15">
            {fileName}
          </span>
        ) : null}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {previewUrl ? (
        <div className="rounded-lg border border-brand-navy/15 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-navy/70">Your logo preview</p>
          <div className="flex justify-center rounded-md bg-slate-50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL from user file */}
            <img
              src={previewUrl}
              alt={`Preview of ${fileName ?? "selected logo"}`}
              className="max-h-56 w-full max-w-lg object-contain"
            />
          </div>
        </div>
      ) : null}
      {fileName && !previewUrl ? (
        <div className="rounded-lg border border-brand-navy/10 bg-brand-navy/[0.03] px-3 py-2 text-xs text-brand-navy/80">
          <span className="font-semibold text-brand-navy">Attached:</span> {fileName}
          <p className="mt-1 text-brand-navy/65">
            PDF and Adobe Illustrator (.ai) files cannot be previewed in the browser. Your file will still be sent with
            the quote.
          </p>
        </div>
      ) : null}
      {fileName ? (
        <button
          type="button"
          className="w-fit text-xs font-semibold text-brand-orange underline-offset-2 hover:underline"
          onClick={() => assignFile(null)}
        >
          Remove file
        </button>
      ) : null}
    </div>
  );
}

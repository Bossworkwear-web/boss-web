"use client";

import { useEffect, useState } from "react";

import type { QuoteSentEmailPreview } from "@/lib/crm/quote-sent-customer-email";

export function PreviewQuoteSentEmailButton({ preview }: { preview: QuoteSentEmailPreview | null }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"html" | "plain">("html");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        disabled={!preview}
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-brand-navy transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Preview
      </button>

      {open && preview ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="quote-email-preview-title"
            aria-modal="true"
            className="flex max-h-[min(92vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h2 id="quote-email-preview-title" className="text-base font-semibold text-brand-navy">
                  Customer email preview
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Reflects saved email fields. Save any edits above before sending.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 border-b border-slate-100 px-4 py-3 text-sm">
              <p>
                <span className="font-semibold text-slate-600">To:</span> {preview.to}
              </p>
              <p>
                <span className="font-semibold text-slate-600">Subject:</span> {preview.subject}
              </p>
            </div>

            <div className="flex gap-2 border-b border-slate-100 px-4 py-2">
              <button
                type="button"
                onClick={() => setView("html")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  view === "html"
                    ? "bg-brand-orange/20 text-brand-navy"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                As customer sees (HTML)
              </button>
              <button
                type="button"
                onClick={() => setView("plain")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  view === "plain"
                    ? "bg-brand-orange/20 text-brand-navy"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Plain text body
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {view === "html" ? (
                <div
                  className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              ) : (
                <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-sans text-xs leading-relaxed text-slate-800">
                  {preview.plainTextBody}
                </pre>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateQuoteEmbroideryPrintServiceDraft } from "../../actions";

function detail(text: string | null | undefined) {
  const t = text?.trim();
  return t ? t : "—";
}

type Props = {
  quoteId: string;
  savedEmbroidery: string | null;
  savedPrint: string | null;
  enquiryServiceType: string | null;
  enquiryEmbroideryPositions: string | null;
  enquiryPrintingPositions: string | null;
};

export function EmbroideryPrintServiceBox({
  quoteId,
  savedEmbroidery,
  savedPrint,
  enquiryServiceType,
  enquiryEmbroideryPositions,
  enquiryPrintingPositions,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [embroidery, setEmbroidery] = useState(() => savedEmbroidery?.trim() ?? "");
  const [printService, setPrintService] = useState(() => savedPrint?.trim() ?? "");

  function save() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const r = await updateQuoteEmbroideryPrintServiceDraft(quoteId, {
        quote_email_embroidery_service: embroidery.trim() || null,
        quote_email_print_service: printService.trim() || null,
      });
      if (!r.ok) {
        setError(r.error ?? "Save failed");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Embroidery / print service</p>
      <p className="mt-1 text-xs text-slate-600">
        Draft how embroidery and printing are described for this quote. Saved on the quote request.
      </p>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
        <p className="font-semibold text-slate-800">From customer enquiry</p>
        <dl className="mt-2 space-y-1">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 text-slate-500 sm:w-36">Service type</dt>
            <dd>{detail(enquiryServiceType)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 text-slate-500 sm:w-36">Embroidery position(s)</dt>
            <dd className="break-words">{detail(enquiryEmbroideryPositions)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 text-slate-500 sm:w-36">Printing position(s)</dt>
            <dd className="break-words">{detail(enquiryPrintingPositions)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="qe-embroidery-service" className="text-xs font-semibold text-slate-700">
            Embroidery service
          </label>
          <textarea
            id="qe-embroidery-service"
            value={embroidery}
            onChange={(e) => setEmbroidery(e.target.value)}
            rows={4}
            className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
            placeholder="e.g. Left chest logo, 8cm max width, supplied artwork…"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="qe-print-service" className="text-xs font-semibold text-slate-700">
            Print service
          </label>
          <textarea
            id="qe-print-service"
            value={printService}
            onChange={(e) => setPrintService(e.target.value)}
            rows={4}
            className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
            placeholder="e.g. Full back screen print, one colour…"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save embroidery / print"}
        </button>
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
    </section>
  );
}

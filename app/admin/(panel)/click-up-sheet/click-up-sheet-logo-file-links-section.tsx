"use client";

import { useEffect, useState, useTransition } from "react";

import {
  loadStoreOrderLogoFileLinks,
  saveStoreOrderLogoFileLinks,
} from "./actions";
import {
  ClickUpSheetShowHideBody,
  ClickUpSheetShowHideHeading,
  useClickUpSheetShowHide,
} from "./click-up-sheet-show-hide";

const MAX_LINKS = 12;

type Props = {
  customerOrderId: string;
  readOnly?: boolean;
};

function rowsForEdit(links: string[]): string[] {
  return links.length > 0 ? [...links] : [""];
}

function LogoLinkFieldList({
  title,
  hint,
  values,
  onChange,
  readOnly,
  pending,
}: {
  title: string;
  hint: string;
  values: string[];
  onChange: (next: string[]) => void;
  readOnly: boolean;
  pending: boolean;
}) {
  const rows = rowsForEdit(values);

  function setRow(index: number, value: string) {
    const next = [...rowsForEdit(values)];
    next[index] = value;
    onChange(next);
  }

  function addRow() {
    if (rowsForEdit(values).length >= MAX_LINKS) return;
    onChange([...rowsForEdit(values), ""]);
  }

  function removeRow(index: number) {
    const next = rowsForEdit(values).filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [""]);
  }

  return (
    <div className="min-w-0 space-y-2">
      <div>
        <p className="text-xs font-semibold text-brand-navy">{title}</p>
        <p className="mt-0.5 text-[0.65rem] text-slate-500">{hint}</p>
      </div>
      <ul className="space-y-2">
        {rows.map((value, index) => (
          <li key={`${title}-${index}`} className="flex items-center gap-2">
            <input
              type="text"
              data-latin-mode="ascii"
              value={value}
              onChange={(e) => setRow(index, e.target.value)}
              disabled={readOnly || pending}
              placeholder={`Link ${index + 1} — file name, path, or URL`}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
            />
            {!readOnly && rows.length > 1 ? (
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={pending}
                aria-label={`Remove ${title} ${index + 1}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!readOnly && rows.length < MAX_LINKS ? (
        <button
          type="button"
          onClick={addRow}
          disabled={pending}
          className="text-xs font-semibold text-brand-orange hover:underline disabled:opacity-50"
        >
          + Add another {title.toLowerCase()}
        </button>
      ) : null}
    </div>
  );
}

export function ClickUpSheetLogoFileLinksSection({ customerOrderId, readOnly = false }: Props) {
  const showHide = useClickUpSheetShowHide();
  const [embroidery, setEmbroidery] = useState<string[]>([""]);
  const [printing, setPrinting] = useState<string[]>([""]);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const num = customerOrderId.trim();
    if (!num) {
      setEmbroidery([""]);
      setPrinting([""]);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void loadStoreOrderLogoFileLinks(num).then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(res.error);
          return;
        }
        setLoadError(null);
        setEmbroidery(rowsForEdit(res.embroideryLogoFileLinks));
        setPrinting(rowsForEdit(res.printingLogoFileLinks));
      });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerOrderId]);

  function onSave() {
    const num = customerOrderId.trim();
    if (!num) {
      setStatus({ ok: false, text: "Enter an Order ID first." });
      return;
    }
    setStatus({ ok: true, text: "Saving…" });
    startTransition(async () => {
      const res = await saveStoreOrderLogoFileLinks({
        orderNumber: num,
        embroideryLogoFileLinks: embroidery,
        printingLogoFileLinks: printing,
      });
      if (!res.ok) {
        setStatus({ ok: false, text: res.error });
        return;
      }
      setStatus({ ok: true, text: "Saved — visible on Production pack." });
      window.setTimeout(() => setStatus(null), 4000);
    });
  }

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
      <ClickUpSheetShowHideHeading
        title="Logo file links"
        open={showHide.open}
        onToggle={showHide.toggle}
      />
      <ClickUpSheetShowHideBody open={showHide.open}>
      <p className="mt-1 text-xs text-slate-600">
        Add one or more embroidery / printing logo file paths or URLs (e.g. front, back, sleeve). Saved to this order
        and shown on <strong>Production pack</strong>.
      </p>

      {loadError ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}
        </p>
      ) : null}

      {!customerOrderId.trim() ? (
        <p className="mt-3 text-sm text-slate-500">Enter an Order ID above to edit logo file links.</p>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <LogoLinkFieldList
            title="Embroidery logo file"
            hint="One link per placement when the customer wants embroidery in multiple positions."
            values={embroidery}
            onChange={setEmbroidery}
            readOnly={readOnly}
            pending={pending}
          />
          <LogoLinkFieldList
            title="Printing logo file"
            hint="One link per placement when the customer wants printing in multiple positions."
            values={printing}
            onChange={setPrinting}
            readOnly={readOnly}
            pending={pending}
          />
        </div>
      )}

      {!readOnly && customerOrderId.trim() ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="rounded-lg border border-brand-navy bg-brand-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-brand-navy/90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save logo links"}
          </button>
          {status ? (
            <p className={`text-sm ${status.ok ? "text-emerald-700" : "text-red-700"}`}>{status.text}</p>
          ) : null}
        </div>
      ) : null}
      </ClickUpSheetShowHideBody>
    </section>
  );
}

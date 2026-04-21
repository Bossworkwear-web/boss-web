"use client";

import { useEffect, useMemo, useState } from "react";

import {
  QUALITY_CHECKLIST_ITEMS,
  qualityCheckInspectionStorageKey,
  qualityChecklistStorageKey,
  qualityCheckNoteStorageKey,
  readQualityChecklistFromStorageKey,
  readQualityInspectionFromStorageKey,
  readQualityNoteFromStorageKey,
  type QualityChecklistSheetState,
  type QualityInspectionPayload,
} from "@/lib/quality-check-local-storage";

export function CompleteStatementLocalSnapshot({
  listDate,
  customerOrderId,
}: {
  listDate: string;
  customerOrderId: string;
}) {
  const ld = listDate.trim();
  const oid = customerOrderId.trim();

  const keys = useMemo(
    () => ({
      checklist: qualityChecklistStorageKey(ld, oid),
      note: qualityCheckNoteStorageKey(ld, oid),
      inspection: qualityCheckInspectionStorageKey(ld, oid),
    }),
    [ld, oid],
  );

  const [checklist, setChecklist] = useState<QualityChecklistSheetState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [inspection, setInspection] = useState<QualityInspectionPayload | null>(null);

  useEffect(() => {
    function refresh() {
      setChecklist(readQualityChecklistFromStorageKey(keys.checklist));
      setNote(readQualityNoteFromStorageKey(keys.note));
      setInspection(readQualityInspectionFromStorageKey(keys.inspection));
    }
    refresh();
    function onStorage(e: StorageEvent) {
      if (e.key === keys.checklist || e.key === keys.note || e.key === keys.inspection) {
        refresh();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [keys.checklist, keys.inspection, keys.note]);

  if (checklist === null || note === null) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-600 shadow-sm">
        Loading QC data from this browser…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-navy">Quality checklist (this browser)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Values come from the same device where Quality Check was filled in. If you open this page on another computer,
          this section may be empty.
        </p>
        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
          {QUALITY_CHECKLIST_ITEMS.map(({ id, label }) => (
            <li key={id} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                    checklist.checks[id]
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                  aria-label={checklist.checks[id] ? "Checked" : "Not checked"}
                >
                  {checklist.checks[id] ? "✓" : "—"}
                </span>
                <span className="text-sm font-medium text-slate-800">{label}</span>
              </div>
              {(checklist.comments[id] ?? "").trim().length > 0 ? (
                <p className="text-sm text-slate-600 sm:max-w-[55%] sm:text-right">{(checklist.comments[id] ?? "").trim()}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-navy">QC note</h2>
        {note.trim().length > 0 ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/90 p-4 text-sm text-slate-800">
            {note.trim()}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No note saved for this order in this browser.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-navy">Inspection sign-off</h2>
        {inspection ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Inspector</dt>
              <dd className="mt-0.5 text-slate-900">{inspection.inspectorName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Signed off</dt>
              <dd className="mt-0.5 text-slate-900">
                {new Date(inspection.completedAt).toLocaleString("en-AU", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No inspection record in this browser.</p>
        )}
      </section>
    </div>
  );
}

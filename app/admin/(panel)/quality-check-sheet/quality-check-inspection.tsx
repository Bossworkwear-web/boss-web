"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  isQualityChecklistFullyChecked,
  notifyQualityInspectionChanged,
  QUALITY_CHECKLIST_CHANGED_EVENT,
  qualityCheckInspectionStorageKey,
  qualityChecklistStorageKey,
  readQualityChecklistFromStorageKey,
  readQualityInspectionFromStorageKey,
  writeQualityCheckSheetSnapshot,
  type QualityInspectionPayload,
} from "@/lib/quality-check-local-storage";

function readInspection(key: string): QualityInspectionPayload | null {
  return readQualityInspectionFromStorageKey(key);
}

export function QualityCheckInspection({
  listDate,
  customerOrderId,
  completeOrdersDocumentsView = false,
}: {
  listDate: string;
  customerOrderId: string;
  completeOrdersDocumentsView?: boolean;
}) {
  const ld = listDate.trim();
  const oid = customerOrderId.trim();
  const canUseStorage = ld.length > 0 && oid.length > 0;

  const key = useMemo(
    () => (canUseStorage ? qualityCheckInspectionStorageKey(ld, oid) : ""),
    [canUseStorage, ld, oid],
  );

  const checklistKey = useMemo(
    () => (canUseStorage ? qualityChecklistStorageKey(ld, oid) : ""),
    [canUseStorage, ld, oid],
  );

  const [inspectorName, setInspectorName] = useState("");
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [allChecklistChecked, setAllChecklistChecked] = useState(false);

  useEffect(() => {
    if (!key) return;
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate inspection record from localStorage */
    const existing = readInspection(key);
    if (existing) {
      setInspectorName(existing.inspectorName);
      setCompletedAt(existing.completedAt);
    } else {
      setInspectorName("");
      setCompletedAt(null);
    }
    setError(null);
    setJustSaved(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (existing?.completedAt) {
      queueMicrotask(() => {
        notifyQualityInspectionChanged(key);
      });
    }
  }, [key]);

  useEffect(() => {
    if (!checklistKey) {
      setAllChecklistChecked(false);
      return;
    }
    const syncFromChecklist = () => {
      setAllChecklistChecked(isQualityChecklistFullyChecked(readQualityChecklistFromStorageKey(checklistKey)));
    };
    const onChecklistCustom = (e: Event) => {
      const ce = e as CustomEvent<{ key?: string }>;
      if (ce.detail?.key === checklistKey) {
        syncFromChecklist();
      }
    };
    const onChecklistStorage = (ev: StorageEvent) => {
      if (ev.key === checklistKey) {
        syncFromChecklist();
      }
    };
    window.addEventListener(QUALITY_CHECKLIST_CHANGED_EVENT, onChecklistCustom);
    window.addEventListener("storage", onChecklistStorage);
    syncFromChecklist();
    return () => {
      window.removeEventListener(QUALITY_CHECKLIST_CHANGED_EVENT, onChecklistCustom);
      window.removeEventListener("storage", onChecklistStorage);
    };
  }, [checklistKey]);

  const canCompleteInspection = allChecklistChecked && inspectorName.trim().length > 0;

  const handleComplete = useCallback(() => {
    if (completeOrdersDocumentsView) return;
    setError(null);
    setJustSaved(false);
    if (!checklistKey) {
      return;
    }
    if (!isQualityChecklistFullyChecked(readQualityChecklistFromStorageKey(checklistKey))) {
      setError("Checklist의 모든 항목을 체크한 뒤 다시 시도하세요.");
      return;
    }
    const trimmed = inspectorName.trim();
    if (!trimmed) {
      setError("Please enter the inspector's name.");
      return;
    }
    if (!key || typeof window === "undefined") return;

    const at = new Date().toISOString();
    const payload: QualityInspectionPayload = { inspectorName: trimmed, completedAt: at };
    window.localStorage.setItem(key, JSON.stringify(payload));
    writeQualityCheckSheetSnapshot(ld, oid, payload);
    setCompletedAt(at);
    setInspectorName(trimmed);
    setJustSaved(true);
    queueMicrotask(() => {
      notifyQualityInspectionChanged(key);
    });
  }, [checklistKey, completeOrdersDocumentsView, inspectorName, key, ld, oid]);

  if (!canUseStorage) {
    return null;
  }

  const lastSavedLabel =
    completedAt != null
      ? new Date(completedAt).toLocaleString("en-AU", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-navy">Inspection</h2>
      <p className="mt-1 text-sm text-slate-600">
        After you finish the checklist, enter your name and tap <strong>Complete inspection</strong> to save
        checklist, NOTE, and inspection in this browser. Then <strong>Move to Dispatch</strong> becomes available.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:max-w-md">
        <div>
          <label htmlFor="quality-inspector-name" className="text-sm font-medium text-slate-700">
            Inspector name
          </label>
          <input
            id="quality-inspector-name"
            type="text"
            value={inspectorName}
            readOnly={completeOrdersDocumentsView}
            onChange={(e) => {
              setInspectorName(e.target.value);
              setJustSaved(false);
            }}
            autoComplete="name"
            placeholder="Enter your name"
            className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-orange/50 focus:outline-none focus:ring-2 focus:ring-brand-orange/25 read-only:cursor-default read-only:bg-slate-50"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={completeOrdersDocumentsView || !canCompleteInspection}
              onClick={handleComplete}
              className="inline-flex rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-brand-navy transition hover:brightness-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
            >
              Complete inspection
            </button>
            {justSaved ? (
              <span className="text-sm font-medium text-emerald-700">Saved.</span>
            ) : null}
          </div>
          {!canCompleteInspection ? (
            <p className="text-xs leading-snug text-slate-500">
              Checklist의 <strong>모든</strong> 항목을 체크하고, <strong>Inspector name</strong>에 이름을 입력하면 버튼이
              활성화됩니다.
            </p>
          ) : null}
        </div>

        {lastSavedLabel != null && !justSaved ? (
          <p className="text-xs text-slate-500">Last saved: {lastSavedLabel}</p>
        ) : null}
        {justSaved && lastSavedLabel != null ? (
          <p className="text-xs text-slate-500">Saved at: {lastSavedLabel}</p>
        ) : null}
      </div>
    </div>
  );
}

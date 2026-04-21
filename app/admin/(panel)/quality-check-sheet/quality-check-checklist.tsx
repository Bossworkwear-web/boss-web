"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  QUALITY_CHECKLIST_ITEMS,
  emptyQualityChecklistState,
  notifyQualityChecklistChanged,
  qualityChecklistStorageKey,
  readQualityChecklistFromStorageKey,
  writeQualityChecklistToStorageKey,
  type QualityChecklistSheetState,
} from "@/lib/quality-check-local-storage";

function readStored(key: string): QualityChecklistSheetState {
  return readQualityChecklistFromStorageKey(key);
}

function persist(key: string, state: QualityChecklistSheetState) {
  writeQualityChecklistToStorageKey(key, state);
}

export function QualityCheckChecklist({
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
    () => (canUseStorage ? qualityChecklistStorageKey(ld, oid) : ""),
    [canUseStorage, ld, oid],
  );

  const [state, setState] = useState<QualityChecklistSheetState>(() => emptyQualityChecklistState());

  useEffect(() => {
    if (!key) return;
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage once per key */
    setState(readStored(key));
    /* eslint-enable react-hooks/set-state-in-effect */
    queueMicrotask(() => {
      notifyQualityChecklistChanged(key);
    });
  }, [key]);

  const onToggle = useCallback(
    (id: string, value: boolean) => {
      if (completeOrdersDocumentsView || !key) return;
      setState((prev) => {
        const next: QualityChecklistSheetState = {
          checks: { ...prev.checks, [id]: value },
          comments: prev.comments,
        };
        persist(key, next);
        return next;
      });
      queueMicrotask(() => {
        notifyQualityChecklistChanged(key);
      });
    },
    [key, completeOrdersDocumentsView],
  );

  const onComment = useCallback(
    (id: string, value: string) => {
      if (completeOrdersDocumentsView || !key) return;
      setState((prev) => {
        const next: QualityChecklistSheetState = {
          checks: prev.checks,
          comments: { ...prev.comments, [id]: value },
        };
        persist(key, next);
        return next;
      });
    },
    [key, completeOrdersDocumentsView],
  );

  if (!canUseStorage) {
    return (
      <p className="text-sm text-amber-900">
        체크리스트를 저장하려면 위에 <strong>List date</strong>와 <strong>Customer order ID</strong>가 필요합니다. Work
        process에서 행의 <strong>Open Quality Check sheet</strong> 링크로 들어오세요.
      </p>
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-semibold text-brand-navy">Checklist</legend>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {QUALITY_CHECKLIST_ITEMS.map(({ id, label }) => (
          <li
            key={id}
            className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-start gap-3">
              <input
                id={`qc-check-${id}`}
                type="checkbox"
                checked={!!state.checks[id]}
                disabled={completeOrdersDocumentsView}
                onChange={(e) => onToggle(id, e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-orange focus:ring-brand-orange disabled:cursor-not-allowed disabled:opacity-50"
              />
              <label htmlFor={`qc-check-${id}`} className="min-w-0 text-sm font-medium leading-snug text-slate-800">
                {label}
              </label>
            </div>
            <input
              type="text"
              value={state.comments[id] ?? ""}
              readOnly={completeOrdersDocumentsView}
              onChange={(e) => onComment(id, e.target.value)}
              placeholder="코멘트"
              aria-label={`${label} 코멘트`}
              className="h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-orange/50 focus:outline-none focus:ring-2 focus:ring-brand-orange/25 read-only:cursor-default read-only:bg-slate-50"
            />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

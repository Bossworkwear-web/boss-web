"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { qualityCheckNoteStorageKey, readQualityNoteFromStorageKey } from "@/lib/quality-check-local-storage";

function readNote(key: string): string {
  return readQualityNoteFromStorageKey(key);
}

export function QualityCheckNotes({
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
    () => (canUseStorage ? qualityCheckNoteStorageKey(ld, oid) : ""),
    [canUseStorage, ld, oid],
  );

  const [note, setNote] = useState("");

  useEffect(() => {
    if (!key) return;
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate note from localStorage once per key */
    setNote(readNote(key));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [key]);

  const onChange = useCallback(
    (value: string) => {
      if (completeOrdersDocumentsView) return;
      setNote(value);
      if (key && typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    },
    [key, completeOrdersDocumentsView],
  );

  if (!canUseStorage) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-4 shadow-sm">
      <label htmlFor="quality-check-note" className="text-sm font-semibold tracking-wide text-brand-navy">
        NOTE
      </label>
      <textarea
        id="quality-check-note"
        value={note}
        readOnly={completeOrdersDocumentsView}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="기타 메모, 이슈, 후속 조치 등을 적어 주세요."
        className="mt-3 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-brand-orange/50 focus:outline-none focus:ring-2 focus:ring-brand-orange/25 read-only:cursor-default read-only:bg-slate-50"
      />
    </div>
  );
}

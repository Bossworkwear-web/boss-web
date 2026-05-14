"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { moveStoreOrderToDispatchFromQualityCheckSheet } from "./actions";
import {
  QUALITY_INSPECTION_CHANGED_EVENT,
  qualityCheckInspectionStorageKey,
  readQualityInspectionFromStorageKey,
} from "@/lib/quality-check-local-storage";

const BTN_CLASS =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow-sm transition border border-brand-orange bg-brand-orange text-brand-navy hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100";

type Props = {
  listDate: string;
  customerOrderId: string;
  completeOrdersDocumentsView?: boolean;
};

export function MoveToDispatchForm({
  listDate,
  customerOrderId,
  completeOrdersDocumentsView = false,
}: Props) {
  const ld = listDate.trim();
  const oid = customerOrderId.trim();
  const inspectionKey = useMemo(
    () => (ld && oid ? qualityCheckInspectionStorageKey(ld, oid) : ""),
    [ld, oid],
  );

  const [inspectionPayload, setInspectionPayload] = useState<ReturnType<typeof readQualityInspectionFromStorageKey>>(
    null,
  );

  const sync = useCallback(() => {
    if (!inspectionKey) {
      setInspectionPayload(null);
      return;
    }
    setInspectionPayload(readQualityInspectionFromStorageKey(inspectionKey));
  }, [inspectionKey]);

  useEffect(() => {
    if (!inspectionKey) return;
    const onInspection = (e: Event) => {
      const ce = e as CustomEvent<{ key?: string }>;
      if (ce.detail?.key === inspectionKey) {
        sync();
      }
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === inspectionKey) {
        sync();
      }
    };
    window.addEventListener(QUALITY_INSPECTION_CHANGED_EVENT, onInspection);
    window.addEventListener("storage", onStorage);
    sync();
    return () => {
      window.removeEventListener(QUALITY_INSPECTION_CHANGED_EVENT, onInspection);
      window.removeEventListener("storage", onStorage);
    };
  }, [inspectionKey, sync]);

  const canMoveToDispatch = Boolean(inspectionPayload?.completedAt && inspectionPayload.inspectorName.trim());

  if (!ld || !oid) {
    return null;
  }

  if (completeOrdersDocumentsView) {
    return (
      <div className="max-w-[min(100%,22rem)] shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs text-slate-700">
        문서 보기 모드에서는 Dispatch로 이동할 수 없습니다.
      </div>
    );
  }

  return (
    <div className="flex max-w-[min(100%,20rem)] shrink-0 flex-col items-end gap-1">
      <form action={moveStoreOrderToDispatchFromQualityCheckSheet} className="inline-flex">
        <input type="hidden" name="list_date" value={ld} />
        <input type="hidden" name="customer_order_id" value={oid} />
        <input
          type="hidden"
          name="inspection_saved_json"
          value={canMoveToDispatch && inspectionPayload ? JSON.stringify(inspectionPayload) : "{}"}
        />
        <button type="submit" disabled={!canMoveToDispatch} className={BTN_CLASS}>
          Move to Dispatch
        </button>
      </form>
      {!canMoveToDispatch ? (
        <p className="max-w-[20rem] text-right text-[0.65rem] leading-snug text-slate-500">
          <strong>Complete inspection</strong>을 눌러 검사를 저장한 뒤 이동할 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}

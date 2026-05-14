/** Keys and helpers shared by Quality Check sheet UI and Complete Statement (browser localStorage). */

export const QUALITY_CHECKLIST_ITEMS: { id: string; label: string }[] = [
  { id: "match-work-sheet", label: "Match work sheet" },
  { id: "check-quality", label: "Check Quality" },
  { id: "check-colour-size", label: "Check Colour & Size" },
  { id: "check-embroidery-quality", label: "Check Embroidery quality" },
  { id: "check-printing-quality", label: "Check Printing Quality" },
  { id: "check-logo-printing-location", label: "Check Logo & printing Location" },
  { id: "check-packaging", label: "Check packaging" },
  { id: "check-delivery-docket", label: "Check Delivery Docket" },
];

export function qualityChecklistStorageKey(listDate: string, customerOrderId: string) {
  return `bossww:quality-check-checklist:v2:${listDate.trim()}::${customerOrderId.trim()}`;
}

export function qualityCheckNoteStorageKey(listDate: string, customerOrderId: string) {
  return `bossww:quality-check-note:v1:${listDate.trim()}::${customerOrderId.trim()}`;
}

export function qualityCheckInspectionStorageKey(listDate: string, customerOrderId: string) {
  return `bossww:quality-check-inspection:v1:${listDate.trim()}::${customerOrderId.trim()}`;
}

export type QualityChecklistSheetState = {
  checks: Record<string, boolean>;
  comments: Record<string, string>;
};

export function emptyQualityChecklistState(): QualityChecklistSheetState {
  const checks: Record<string, boolean> = {};
  const comments: Record<string, string> = {};
  for (const item of QUALITY_CHECKLIST_ITEMS) {
    checks[item.id] = false;
    comments[item.id] = "";
  }
  return { checks, comments };
}

/** True when every checklist item is checked. */
export function isQualityChecklistFullyChecked(state: QualityChecklistSheetState): boolean {
  return QUALITY_CHECKLIST_ITEMS.every((item) => state.checks[item.id] === true);
}

/** Fired after checklist writes to localStorage (same tab). Other tabs: `storage` event. */
export const QUALITY_CHECKLIST_CHANGED_EVENT = "bossww:quality-checklist-changed";

export function notifyQualityChecklistChanged(storageKey: string) {
  if (typeof window === "undefined" || !storageKey) return;
  window.dispatchEvent(new CustomEvent(QUALITY_CHECKLIST_CHANGED_EVENT, { detail: { key: storageKey } }));
}

function legacyQualityChecklistStorageKeyV1FromV2Key(v2Key: string): string | null {
  if (!v2Key.includes(":quality-check-checklist:v2:")) return null;
  return v2Key.replace(":quality-check-checklist:v2:", ":quality-check-checklist:v1:");
}

export function readQualityChecklistFromStorageKey(key: string): QualityChecklistSheetState {
  const base = emptyQualityChecklistState();
  if (!key || typeof window === "undefined") return base;
  try {
    let raw = window.localStorage.getItem(key);
    let migratedFromV1 = false;
    if (!raw) {
      const v1Key = legacyQualityChecklistStorageKeyV1FromV2Key(key);
      if (v1Key) {
        const legacy = window.localStorage.getItem(v1Key);
        if (legacy) {
          raw = legacy;
          migratedFromV1 = true;
        }
      }
    }
    if (!raw) return base;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return base;
    const rec = o as Record<string, unknown>;

    if ("checks" in rec && rec.checks && typeof rec.checks === "object" && !Array.isArray(rec.checks)) {
      const ck = rec.checks as Record<string, unknown>;
      const cm =
        "comments" in rec && rec.comments && typeof rec.comments === "object" && !Array.isArray(rec.comments)
          ? (rec.comments as Record<string, unknown>)
          : {};
      for (const item of QUALITY_CHECKLIST_ITEMS) {
        base.checks[item.id] = ck[item.id] === true;
        const c = cm[item.id];
        base.comments[item.id] = typeof c === "string" ? c : "";
      }
      if (migratedFromV1) {
        for (const item of QUALITY_CHECKLIST_ITEMS) {
          base.checks[item.id] = false;
        }
        writeQualityChecklistToStorageKey(key, base);
      }
      return base;
    }

    for (const item of QUALITY_CHECKLIST_ITEMS) {
      base.checks[item.id] = rec[item.id] === true;
    }
    if (migratedFromV1) {
      for (const item of QUALITY_CHECKLIST_ITEMS) {
        base.checks[item.id] = false;
      }
      writeQualityChecklistToStorageKey(key, base);
    }
    return base;
  } catch {
    return base;
  }
}

export function writeQualityChecklistToStorageKey(key: string, state: QualityChecklistSheetState) {
  if (!key || typeof window === "undefined") return;
  window.localStorage.setItem(
    key,
    JSON.stringify({
      checks: state.checks,
      comments: state.comments,
    }),
  );
}

export type QualityInspectionPayload = {
  inspectorName: string;
  completedAt: string;
};

export function readQualityInspectionFromStorageKey(key: string): QualityInspectionPayload | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    const inspectorName = typeof rec.inspectorName === "string" ? rec.inspectorName : "";
    const completedAt = typeof rec.completedAt === "string" ? rec.completedAt : "";
    if (!completedAt) return null;
    return { inspectorName, completedAt };
  } catch {
    return null;
  }
}

export function readQualityNoteFromStorageKey(key: string): string {
  if (!key || typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** Full sheet snapshot written when user taps Complete inspection (this browser). */
export type QualityCheckSheetSnapshotV1 = {
  v: 1;
  savedAt: string;
  checklist: QualityChecklistSheetState;
  note: string;
  inspection: QualityInspectionPayload;
};

export function qualityCheckSheetSnapshotStorageKey(listDate: string, customerOrderId: string) {
  return `bossww:quality-check-sheet-snapshot:v1:${listDate.trim()}::${customerOrderId.trim()}`;
}

/** Persists checklist + NOTE + inspection together under one snapshot key. */
export function writeQualityCheckSheetSnapshot(
  listDate: string,
  customerOrderId: string,
  inspection: QualityInspectionPayload,
): void {
  if (typeof window === "undefined") return;
  const ld = listDate.trim();
  const oid = customerOrderId.trim();
  if (!ld || !oid) return;
  const ckKey = qualityChecklistStorageKey(ld, oid);
  const noteKey = qualityCheckNoteStorageKey(ld, oid);
  const snapKey = qualityCheckSheetSnapshotStorageKey(ld, oid);
  const checklist = readQualityChecklistFromStorageKey(ckKey);
  const note = readQualityNoteFromStorageKey(noteKey);
  const body: QualityCheckSheetSnapshotV1 = {
    v: 1,
    savedAt: inspection.completedAt,
    checklist,
    note,
    inspection,
  };
  window.localStorage.setItem(snapKey, JSON.stringify(body));
}

export const QUALITY_INSPECTION_CHANGED_EVENT = "bossww:quality-inspection-changed";

export function notifyQualityInspectionChanged(inspectionStorageKey: string) {
  if (typeof window === "undefined" || !inspectionStorageKey) return;
  window.dispatchEvent(new CustomEvent(QUALITY_INSPECTION_CHANGED_EVENT, { detail: { key: inspectionStorageKey } }));
}

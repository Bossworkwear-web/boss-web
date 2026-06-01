export const MOCKUP_DECORATE_METHOD_OPTIONS = ["Embroidery", "DTF/HTV", "Sublimation"] as const;
export type MockupDecorateMethod = (typeof MOCKUP_DECORATE_METHOD_OPTIONS)[number];

const ALLOWED = new Set<string>(MOCKUP_DECORATE_METHOD_OPTIONS);

/** Mock-up methods stored as printing-style decoration (vs embroidery). */
const PRINTING_STYLE_METHODS = new Set<string>(["DTF/HTV", "Sublimation"]);

/**
 * One-line summary for production/worker UIs: embroidery vs printing.
 * `DTF/HTV` and `Sublimation` are grouped as **Printing**.
 */
export function mockupEmbroideryPrintingSummary(labels: string[]): string {
  const emb = labels.includes("Embroidery");
  const printing = labels.some((l) => PRINTING_STYLE_METHODS.has(l));
  if (emb && printing) {
    return "Embroidery · Printing";
  }
  if (emb) {
    return "Embroidery";
  }
  if (printing) {
    return "Printing";
  }
  if (labels.length > 0) {
    return labels.join(" · ");
  }
  return "Not specified";
}

/** Keep only allowed method labels, deduped, stable order. */
export function sanitizeMockupDecorateMethodsFromClient(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim();
    if (!ALLOWED.has(t) || out.includes(t)) {
      continue;
    }
    out.push(t);
  }
  return out;
}

/** Parse JSON array from DB column; invalid → []. */
export function parseMockupDecorateMethodsJson(s: string | null | undefined): string[] {
  if (!s?.trim()) {
    return [];
  }
  try {
    const j = JSON.parse(s) as unknown;
    return sanitizeMockupDecorateMethodsFromClient(Array.isArray(j) ? j : []);
  } catch {
    return [];
  }
}

type MockupDisplaySortable = {
  sort_order: number;
  created_at: string;
  inherited_from_order_number?: string | null;
};

function compareMockupsChronologically(a: MockupDisplaySortable, b: MockupDisplaySortable): number {
  const bySort = a.sort_order - b.sort_order;
  if (bySort !== 0) {
    return bySort;
  }
  return a.created_at.localeCompare(b.created_at);
}

/**
 * Own mock-ups first, oldest → newest (`sort_order`, then `created_at`).
 * Reorder carry-over mock-ups from a prior order are appended after.
 */
export function sortClickUpSheetMockupsForDisplay<T extends MockupDisplaySortable>(images: T[]): T[] {
  const own: T[] = [];
  const inherited: T[] = [];
  for (const img of images) {
    if ((img.inherited_from_order_number ?? "").trim()) {
      inherited.push(img);
    } else {
      own.push(img);
    }
  }
  own.sort(compareMockupsChronologically);
  inherited.sort(compareMockupsChronologically);
  return [...own, ...inherited];
}

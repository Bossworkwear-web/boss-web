/** Carriers selectable on Admin → Dispatch. */
export const DISPATCH_CARRIER_OPTIONS = ["Auspost", "ARAMEX", "Quick Lee"] as const;
export type DispatchCarrierOption = (typeof DISPATCH_CARRIER_OPTIONS)[number];

export function normalizeDispatchCarrierOption(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) {
    return "";
  }
  for (const opt of DISPATCH_CARRIER_OPTIONS) {
    if (opt.toLowerCase() === t.toLowerCase()) {
      return opt;
    }
  }
  const lower = t.toLowerCase();
  if (lower.includes("australia post") || lower.includes("auspost") || lower.includes("aus post")) {
    return "Auspost";
  }
  if (lower.includes("aramex")) {
    return "ARAMEX";
  }
  if (lower.includes("quick lee") || lower.includes("quicklee")) {
    return "Quick Lee";
  }
  return "";
}

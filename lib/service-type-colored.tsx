import type { ReactNode } from "react";

const SPLIT_PLUS = /\s*\+\s*/;

function segmentClassName(segment: string): string {
  const lower = segment.toLowerCase();
  if (lower.includes("printing")) {
    return "font-semibold text-red-600";
  }
  if (lower.includes("embroidery")) {
    return "font-semibold text-emerald-700";
  }
  return "";
}

/** Renders store line service text with Embroidery in green and Printing in red (supports `Embroidery + Printing`). */
export function serviceTypeColoredContent(value: string | null | undefined): ReactNode {
  const s = (value ?? "").trim();
  if (!s) {
    return "—";
  }
  const segments = s.split(SPLIT_PLUS).map((x) => x.trim()).filter(Boolean);
  if (segments.length === 0) {
    return "—";
  }
  return (
    <>
      {segments.map((seg, idx) => (
        <span key={`${idx}-${seg.slice(0, 40)}`}>
          {idx > 0 ? <span className="text-slate-400"> + </span> : null}
          <span className={segmentClassName(seg) || undefined}>{seg}</span>
        </span>
      ))}
    </>
  );
}

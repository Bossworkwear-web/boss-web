"use client";

import type { ReactNode } from "react";

const defaultDocketHint = (
  <>
    In the print dialog, turn off <strong>Headers and footers</strong> (Chrome/Edge) or the equivalent option so the
    date, URL, and page number are not printed. Margins are set to minimum; use &quot;Default margins&quot; → None if
    you still see extra space. Tape to the parcel or take to the Post Office; add an official Australia Post label from
    MyPost Business / counter if required for network scanning.
  </>
);

export function DocketPrintBar({
  printButtonLabel = "Print docket",
  hint,
}: {
  printButtonLabel?: string;
  hint?: ReactNode;
} = {}) {
  return (
    <div className="no-print border-b border-slate-200 bg-slate-50 px-4 py-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-brand-orange px-[1.4rem] py-[0.7rem] text-[1.05rem] font-semibold text-brand-navy"
      >
        {printButtonLabel}
      </button>
      <p className="mt-3 text-base text-slate-600">{hint ?? defaultDocketHint}</p>
    </div>
  );
}

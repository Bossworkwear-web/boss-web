"use client";

import { useState } from "react";

export function CustomerQuotePortalLink({ absoluteUrl }: { absoluteUrl: string }) {
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Customer acceptance link</p>
      <p className="mt-1 text-xs text-slate-600">
        Send this URL to the customer. They complete empty quote fields and click Accept Quote. The deal moves to{" "}
        <strong>Approval</strong> and the merged quote is saved.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="block max-w-full flex-1 break-all rounded border border-emerald-100 bg-white px-2 py-1.5 text-[11px] text-slate-800">
          {absoluteUrl}
        </code>
        <button
          type="button"
          className="shrink-0 rounded-md border border-emerald-700/30 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-100"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(absoluteUrl);
              setMsg("Copied.");
            } catch {
              setMsg("Could not copy.");
            }
          }}
        >
          Copy link
        </button>
      </div>
      {msg ? <p className="mt-1 text-xs text-emerald-900">{msg}</p> : null}
    </div>
  );
}

"use client";

import { useCallback } from "react";

let printIframe: HTMLIFrameElement | null = null;

function ensurePrintIframe(): HTMLIFrameElement | null {
  if (typeof document === "undefined") return null;
  if (!printIframe) {
    const iframe = document.createElement("iframe");
    iframe.title = "Print docket";
    iframe.style.cssText =
      "position:fixed;width:0;height:0;border:0;left:-9999px;pointer-events:none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);
    printIframe = iframe;
  }
  return printIframe;
}

export function PrintDocketButton({
  storeOrderId,
  className,
}: {
  storeOrderId: string;
  className?: string;
}) {
  const onClick = useCallback(() => {
    const iframe = ensurePrintIframe();
    if (!iframe) return;
    const id = encodeURIComponent(storeOrderId);
    iframe.src = `/admin/store-orders/${id}/docket?autoprint=1&t=${Date.now()}`;
  }, [storeOrderId]);

  return (
    <button type="button" onClick={onClick} className={className}>
      Print Docket
    </button>
  );
}

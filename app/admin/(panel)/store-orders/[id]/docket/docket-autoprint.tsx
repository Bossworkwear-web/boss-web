"use client";

import { useEffect } from "react";

/**
 * When opened with `?autoprint=1`, opens the browser print dialog after paint (e.g. from Dispatch → Print Docket).
 */
export function DocketAutoprint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => {
      window.print();
    }, 450);
    return () => window.clearTimeout(id);
  }, [enabled]);

  return null;
}

"use client";

import { useEffect, useState } from "react";

/** Laptop / desktop monitors only — excludes phones and tablets (iPad landscape ≈ 1024px). */
export const DESKTOP_ASSIST_MEDIA = "(min-width: 1280px)";

export function useDesktopAssistEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_ASSIST_MEDIA);
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return enabled;
}

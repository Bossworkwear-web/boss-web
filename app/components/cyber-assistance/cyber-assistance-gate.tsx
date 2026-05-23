"use client";

import { usePathname } from "next/navigation";

import { CyberAssistanceWidget } from "@/app/components/cyber-assistance/cyber-assistance-widget";
import { isCyberAssistPath } from "@/lib/cyber-assistance/page-context";

/** Storefront product + category browse — not admin; mobile/tablet hidden in widget. */
export function CyberAssistanceGate() {
  const pathname = usePathname();
  if (!isCyberAssistPath(pathname)) {
    return null;
  }
  return <CyberAssistanceWidget />;
}

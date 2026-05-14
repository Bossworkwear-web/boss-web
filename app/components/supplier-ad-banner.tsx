import type { ReactNode } from "react";

import { STORE_MAIN_SHELL_CLASS } from "@/lib/store-main-shell";

/**
 * Page body wrapper (below `TopNav`). Server Component — use `STORE_MAIN_SHELL_CLASS` in `"use client"` pages.
 */
export function MainWithSupplierRail({ children }: { children: ReactNode }) {
  return <div className={STORE_MAIN_SHELL_CLASS}>{children}</div>;
}

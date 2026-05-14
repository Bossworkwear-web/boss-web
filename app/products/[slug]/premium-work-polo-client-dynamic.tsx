"use client";

import type { PremiumWorkPoloClientProps } from "../premium-work-polo/premium-work-polo-client";
import { PremiumWorkPoloClient } from "../premium-work-polo/premium-work-polo-client";

/**
 * Wrapper kept so `page.tsx` imports stay stable. Previously used `next/dynamic`; static import avoids
 * Turbopack dev occasionally hydrating with a stale SSR chunk vs fresh client chunk for the PDP.
 */
export function PremiumWorkPoloClientDynamic(props: PremiumWorkPoloClientProps) {
  return <PremiumWorkPoloClient {...props} />;
}

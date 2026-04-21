"use client";

import nextDynamic from "next/dynamic";

import type { PremiumWorkPoloClientProps } from "../premium-work-polo/premium-work-polo-client";

const productDetailLoading = (
  <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
    <p className="px-[5cm] py-10 text-sm text-brand-navy/60">Loading product…</p>
  </main>
);

const PremiumWorkPoloClient = nextDynamic(
  () =>
    import("../premium-work-polo/premium-work-polo-client").then((m) => m.PremiumWorkPoloClient),
  /** SSR on so crawlers & “preview” UIs see retail prices in HTML, not only after client JS. */
  { loading: () => productDetailLoading },
);

export function PremiumWorkPoloClientDynamic(props: PremiumWorkPoloClientProps) {
  return <PremiumWorkPoloClient {...props} />;
}

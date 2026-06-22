import { LoadingRingSpinner } from "@/app/components/loading-ring-spinner";

/** Instant fallback while a storefront RSC route resolves (categories, PDP, etc.). */
export function StorefrontRouteLoadingShell() {
  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <div className="flex min-h-[45vh] items-center justify-center p-8" role="status" aria-busy="true" aria-label="Loading page">
        <LoadingRingSpinner className="h-10 w-10" />
      </div>
    </main>
  );
}

import Link from "next/link";

import { checkStorefrontCatalogHealth } from "@/lib/storefront-catalog-health";

export async function StorefrontCatalogHealthBanner() {
  const health = await checkStorefrontCatalogHealth();
  if (health.ok) {
    return null;
  }

  return (
    <section
      className="rounded-xl border border-red-300 bg-red-50 px-4 py-4 text-sm text-red-950"
      role="alert"
    >
      <p className="font-semibold text-red-900">Storefront catalog is not loading correctly</p>
      <p className="mt-1">
        Category pages may show no products. Active catalog rows returned:{" "}
        <strong>{health.productCount}</strong>.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {health.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
      <p className="mt-3 text-red-900">
        Fix: sync Supabase API keys to Vercel and trigger a <strong>new production build</strong>. See{" "}
        <code className="rounded bg-white/80 px-1">docs/SUPABASE_VERCEL_ENV.md</code> or run{" "}
        <code className="rounded bg-white/80 px-1">npm run sync:vercel-supabase-env</code>.
      </p>
      <p className="mt-2">
        <Link href="/categories/workwear" className="font-semibold text-brand-orange underline-offset-2 hover:underline">
          Open Workwear category
        </Link>{" "}
        to verify after fixing.
      </p>
    </section>
  );
}

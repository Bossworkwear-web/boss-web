import {
  fetchActiveProductsBrowseRowsUncached,
  isLikelySupabaseConnectionOrAuthError,
  StorefrontCatalogFetchError,
} from "@/lib/storefront-catalog-fetch";

export type StorefrontCatalogHealth = {
  ok: boolean;
  productCount: number;
  issues: string[];
  checkedAt: string;
};

function minExpectedProducts(): number {
  const raw = Number(process.env.STOREFRONT_CATALOG_MIN_PRODUCTS ?? 100);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 100;
}

function envIssues(): string[] {
  const issues: string[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL is not set on this deployment.");
  }
  if (!anon) {
    issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set on this deployment.");
  } else if (!anon.startsWith("sb_publishable_") && !anon.startsWith("eyJ")) {
    issues.push(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY format looks unusual — confirm it matches Supabase Dashboard → API keys.",
    );
  }
  return issues;
}

/** Live catalog probe (same path as category pages). Used by cron + admin banner. */
export async function checkStorefrontCatalogHealth(): Promise<StorefrontCatalogHealth> {
  const issues = [...envIssues()];
  let productCount = 0;

  try {
    const rows = await fetchActiveProductsBrowseRowsUncached();
    productCount = rows.length;
    const min = minExpectedProducts();
    if (productCount < min) {
      issues.push(
        `Storefront catalog returned only ${productCount} active products (expected at least ${min}).`,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof StorefrontCatalogFetchError || isLikelySupabaseConnectionOrAuthError(msg)) {
      issues.push(`Supabase catalog fetch failed: ${msg}`);
    } else {
      issues.push(`Unexpected catalog health error: ${msg}`);
    }
  }

  return {
    ok: issues.length === 0,
    productCount,
    issues,
    checkedAt: new Date().toISOString(),
  };
}

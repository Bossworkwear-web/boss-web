import type { CategoryBrowseProductRow } from "@/lib/main-category-browse";
import { createSupabaseClient } from "@/lib/supabase";

export class StorefrontCatalogFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorefrontCatalogFetchError";
  }
}

function errorMessage(error: unknown): string {
  return String((error as { message?: unknown } | null)?.message ?? error);
}

export function isLikelySupabaseConnectionOrAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("invalid api key") ||
    m.includes("invalid jwt") ||
    m.includes("jwt expired") ||
    m.includes("unauthorized") ||
    m.includes("permission denied") ||
    m.includes("fetch failed") ||
    m.includes("enotfound") ||
    m.includes("econnrefused") ||
    m.includes("network") ||
    m.includes("missing next_public_supabase")
  );
}

function isMissingColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("audience") ||
    m.includes("supplier_name") ||
    m.includes("image_urls") ||
    m.includes("sale_price") ||
    m.includes("column") ||
    m.includes("does not exist")
  );
}

function isBrowseViewMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("storefront_browse_products") ||
    (m.includes("relation") && m.includes("does not exist"))
  );
}

function withoutSalePrice(select: string): string {
  return select
    .replace(/,\s*sale_price\s*,/i, ", ")
    .replace(/,\s*sale_price\s*$/i, "")
    .replace(/^\s*sale_price\s*,\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();
}

function failOnHardError(error: unknown, context: string): never {
  const msg = errorMessage(error);
  console.error(`[storefront-catalog] ${context}:`, msg);
  throw new StorefrontCatalogFetchError(`${context}: ${msg}`);
}

const BROWSE_SELECT =
  "id, name, base_price, sale_price, image_urls, category, slug, description, storefront_hidden, audience, supplier_name, available_colors, available_sizes";

/**
 * One PostgREST round-trip via `storefront_browse_products` (trimmed image_urls).
 * Avoids paginated RPC loops (~7 sequential calls for ~3k SKUs).
 */
async function fetchActiveProductsBrowseRowsViaView(
  supabase: ReturnType<typeof createSupabaseClient>,
  maxScan: number,
): Promise<CategoryBrowseProductRow[] | null> {
  const res = await supabase
    .from("storefront_browse_products")
    .select(BROWSE_SELECT)
    .order("name")
    .range(0, maxScan - 1);

  if (res.error) {
    const msg = errorMessage(res.error);
    if (isBrowseViewMissingError(msg) || isMissingColumnError(msg)) {
      return null;
    }
    if (isLikelySupabaseConnectionOrAuthError(msg)) {
      failOnHardError(res.error, "Supabase browse view query failed");
    }
    failOnHardError(res.error, "Supabase browse view query failed");
  }

  return (res.data ?? []) as CategoryBrowseProductRow[];
}

async function fetchActiveProductsBrowseRowsLegacy(
  supabase: ReturnType<typeof createSupabaseClient>,
  pageSize: number,
  maxScan: number,
): Promise<CategoryBrowseProductRow[]> {
  const selectWithAudience =
    "id, name, base_price, sale_price, image_urls, category, slug, description, storefront_hidden, audience, supplier_name, available_colors, available_sizes";
  const selectWithoutAudience =
    "id, name, base_price, sale_price, image_urls, category, slug, description, storefront_hidden, supplier_name, available_colors, available_sizes";
  const selectBare =
    "id, name, base_price, sale_price, image_urls, category, slug, description, storefront_hidden, available_colors, available_sizes";

  async function fetchAll(select: string): Promise<{ data: CategoryBrowseProductRow[]; error: unknown }> {
    const out: CategoryBrowseProductRow[] = [];
    for (let offset = 0; offset < maxScan; offset += pageSize) {
      const res = await supabase
        .from("products")
        .select(select)
        .eq("is_active", true)
        .neq("storefront_hidden", true)
        .order("name")
        .range(offset, offset + pageSize - 1);
      if (res.error) {
        return { data: [], error: res.error };
      }
      const chunk = (res.data ?? []) as unknown as CategoryBrowseProductRow[];
      out.push(...chunk);
      if (chunk.length < pageSize) {
        break;
      }
    }
    return { data: out, error: null };
  }

  const primary = await fetchAll(selectWithAudience);

  if (primary.error) {
    const msg = errorMessage(primary.error);
    if (!isMissingColumnError(msg)) {
      if (isLikelySupabaseConnectionOrAuthError(msg)) {
        failOnHardError(primary.error, "Supabase products query failed");
      }
      failOnHardError(primary.error, "Supabase products query failed");
    }

    const missingAudience = msg.includes("audience");
    const missingSupplierName = msg.includes("supplier_name");
    const missingImageUrls = msg.includes("image_urls");
    const missingSalePrice = msg.includes("sale_price");

    const fallbackSelect = missingSupplierName
      ? missingAudience
        ? selectBare
        : selectBare.replace("storefront_hidden", "storefront_hidden, audience")
      : missingAudience
        ? missingImageUrls
          ? "id, name, base_price, sale_price, category, slug, description, storefront_hidden, supplier_name, available_colors, available_sizes"
          : selectWithoutAudience
        : missingImageUrls
          ? "id, name, base_price, sale_price, category, slug, description, storefront_hidden, audience, supplier_name, available_colors, available_sizes"
          : selectWithAudience;

    const secondary = await fetchAll(missingSalePrice ? withoutSalePrice(fallbackSelect) : fallbackSelect);
    if (secondary.error) {
      const secondaryMsg = errorMessage(secondary.error);
      if (!isMissingColumnError(secondaryMsg)) {
        failOnHardError(secondary.error, "Supabase products fallback query failed");
      }
    }

    const data = (secondary.data ?? []) as unknown as CategoryBrowseProductRow[];
    const effectiveSelect = missingSalePrice ? withoutSalePrice(fallbackSelect) : fallbackSelect;
    if (effectiveSelect.includes("image_urls")) {
      return data;
    }
    return data.map((r) => ({ ...r, image_urls: null }));
  }

  const rows = primary.data ?? [];
  if (rows.length === 0) {
    const minimalSelect =
      "id, name, base_price, sale_price, category, slug, description, storefront_hidden, available_colors, available_sizes";
    const minimal = await fetchAll(minimalSelect);
    if (minimal.error) {
      const msg = errorMessage(minimal.error);
      if (msg.includes("sale_price")) {
        const fallback = await fetchAll(withoutSalePrice(minimalSelect));
        if (fallback.error) {
          failOnHardError(fallback.error, "Supabase products minimal query failed");
        }
        return (fallback.data ?? []).map((r) => ({ ...r, image_urls: null }));
      }
      if (!isMissingColumnError(msg)) {
        failOnHardError(minimal.error, "Supabase products minimal query failed");
      }
    }
    return (minimal.data ?? []).map((r) => ({ ...r, image_urls: null }));
  }

  return rows as CategoryBrowseProductRow[];
}

/**
 * Loads active storefront browse rows from Supabase (no Next.js cache).
 * Throws on missing env vars or auth/connection failures so we never silently cache an empty catalog.
 */
export async function fetchActiveProductsBrowseRowsUncached(): Promise<CategoryBrowseProductRow[]> {
  let supabase: ReturnType<typeof createSupabaseClient>;
  try {
    supabase = createSupabaseClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Missing Supabase client configuration";
    console.error("[storefront-catalog] Supabase client unavailable:", msg);
    throw new StorefrontCatalogFetchError(msg);
  }

  const pageSize = Math.max(100, Number(process.env.STOREFRONT_BROWSE_PAGE_SIZE ?? 500));
  const maxScan = Math.max(pageSize, Number(process.env.STOREFRONT_BROWSE_MAX_SCAN ?? 6_000));

  const fromView = await fetchActiveProductsBrowseRowsViaView(supabase, maxScan);
  if (fromView != null) {
    return fromView;
  }

  return fetchActiveProductsBrowseRowsLegacy(supabase, pageSize, maxScan);
}

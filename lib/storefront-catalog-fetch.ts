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

/** PostgREST / Supabase API caps each response at 1000 rows unless project max is raised. */
const POSTGREST_MAX_ROWS_PER_REQUEST = 1000;

/** Default A–name head slice; late-alphabet Chef SKUs are merged from `CHEF_BROWSE_SUPPLEMENT_FILTER`. */
const DEFAULT_BROWSE_HEAD_ROWS = 950;

/**
 * Chef hospitality rows that sort after the head slice (Yes Chef, JB chef, Cool-Breeze, etc.).
 * Kept in sync with storefront Chef browse (~53 SKUs); all fall outside the first ~950 names.
 */
const CHEF_BROWSE_SUPPLEMENT_FILTER = [
  "category.ilike.chef",
  "name.ilike.%Yes Chef%",
  "supplier_name.ilike.%Yes Chef%",
  "name.ilike.%Cool-Breeze Cotton Chef%",
  "name.ilike.%Classic Chef%",
  "name.ilike.%Traditional Chef%",
  "name.ilike.%Three Way Air Flow Chef%",
  "name.ilike.%Polyester Cotton Drawstring Chef%",
  "name.ilike.%Poly Cotton Chefs Hat%",
  "name.ilike.%JB's CHEF%",
  "name.ilike.%CHEFS%",
  "name.ilike.%CHEF POLO%",
  "name.ilike.%CHEF'S%",
].join(",");

function mergeBrowseRowsById(
  head: CategoryBrowseProductRow[],
  supplement: CategoryBrowseProductRow[],
): CategoryBrowseProductRow[] {
  const seen = new Set(head.map((row) => row.id));
  const merged = [...head];
  for (const row of supplement) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }
  return merged;
}

function browseHeadRowCount(): number {
  const raw = Number(process.env.STOREFRONT_BROWSE_HEAD_ROWS ?? DEFAULT_BROWSE_HEAD_ROWS);
  if (!Number.isFinite(raw)) {
    return DEFAULT_BROWSE_HEAD_ROWS;
  }
  return Math.min(POSTGREST_MAX_ROWS_PER_REQUEST - 50, Math.max(100, Math.floor(raw)));
}

/** Default: full catalog. Set STOREFRONT_BROWSE_FAST=1 for ~1k head+chef slice only. */
function browseUsesFastHeadSlice(): boolean {
  return process.env.STOREFRONT_BROWSE_FAST === "1";
}

async function fetchBrowseViewChunk(
  supabase: ReturnType<typeof createSupabaseClient>,
  offset: number,
  limit: number,
): Promise<{ data: CategoryBrowseProductRow[] | null; error: unknown }> {
  const res = await supabase
    .from("storefront_browse_products")
    .select(BROWSE_SELECT)
    .order("name")
    .range(offset, offset + limit - 1);

  if (res.error) {
    return { data: null, error: res.error };
  }
  return { data: (res.data ?? []) as CategoryBrowseProductRow[], error: null };
}

function handleBrowseViewError(error: unknown, context: string): null {
  const msg = errorMessage(error);
  if (isBrowseViewMissingError(msg) || isMissingColumnError(msg)) {
    return null;
  }
  if (isLikelySupabaseConnectionOrAuthError(msg)) {
    failOnHardError(error, context);
  }
  failOnHardError(error, context);
}

/** Full catalog — parallel 1k pages (default). */
async function fetchActiveProductsBrowseRowsViaViewFull(
  supabase: ReturnType<typeof createSupabaseClient>,
  maxScan: number,
): Promise<CategoryBrowseProductRow[] | null> {
  const chunkSize = POSTGREST_MAX_ROWS_PER_REQUEST;
  const offsets: number[] = [];
  for (let offset = 0; offset < maxScan; offset += chunkSize) {
    offsets.push(offset);
  }

  const chunks = await Promise.all(
    offsets.map((offset) => fetchBrowseViewChunk(supabase, offset, chunkSize)),
  );

  const out: CategoryBrowseProductRow[] = [];
  for (const chunk of chunks) {
    if (chunk.error) {
      return handleBrowseViewError(chunk.error, "Supabase browse view query failed");
    }
    out.push(...(chunk.data ?? []));
    if ((chunk.data ?? []).length < chunkSize) {
      break;
    }
  }
  return out;
}

/**
 * Fast path (~1k rows): name-sorted head + Chef supplement in parallel.
 * Chef SKUs (Yes Chef, JB chef, …) sort after row ~950; supplement restores them without scanning all 3k+ rows.
 */
async function fetchActiveProductsBrowseRowsViaViewFast(
  supabase: ReturnType<typeof createSupabaseClient>,
): Promise<CategoryBrowseProductRow[] | null> {
  const headCount = browseHeadRowCount();

  const [headRes, chefRes] = await Promise.all([
    supabase
      .from("storefront_browse_products")
      .select(BROWSE_SELECT)
      .order("name")
      .range(0, headCount - 1),
    supabase
      .from("storefront_browse_products")
      .select(BROWSE_SELECT)
      .or(CHEF_BROWSE_SUPPLEMENT_FILTER)
      .order("name")
      .limit(100),
  ]);

  if (headRes.error) {
    return handleBrowseViewError(headRes.error, "Supabase browse head query failed");
  }
  if (chefRes.error) {
    return handleBrowseViewError(chefRes.error, "Supabase browse chef supplement query failed");
  }

  return mergeBrowseRowsById(
    (headRes.data ?? []) as CategoryBrowseProductRow[],
    (chefRes.data ?? []) as CategoryBrowseProductRow[],
  );
}

async function fetchActiveProductsBrowseRowsViaView(
  supabase: ReturnType<typeof createSupabaseClient>,
  maxScan: number,
): Promise<CategoryBrowseProductRow[] | null> {
  if (browseUsesFastHeadSlice()) {
    return fetchActiveProductsBrowseRowsViaViewFast(supabase);
  }
  return fetchActiveProductsBrowseRowsViaViewFull(supabase, maxScan);
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

import Link from "next/link";

import { createSupabaseAdminClient } from "@/lib/supabase";

import { StockTableClientShell } from "./stock-table-client-shell";

const LOW_STOCK_THRESHOLD = 10;

export default async function AdminStockPage() {
  const supabase = createSupabaseAdminClient();
  const selectCandidates = [
    "id, name, category, supplier_name, base_price, sale_price, stock_quantity, storefront_hidden, storefront_hidden_at, image_urls",
    "id, name, category, supplier_name, base_price, stock_quantity, storefront_hidden, storefront_hidden_at, image_urls",
    "id, name, category, base_price, stock_quantity, storefront_hidden, storefront_hidden_at, image_urls",
    "id, name, category, base_price, stock_quantity, storefront_hidden, image_urls",
    "id, name, category, base_price, stock_quantity, image_urls",
  ] as const;

  type DbRow = Record<string, unknown>;
  type DbError = { message?: string; code?: string };

  async function fetchAllProducts(select: string) {
    const PAGE_SIZE = 1000;
    const all: DbRow[] = [];
    for (let from = 0; from < 50_000; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const result = await supabase.from("products").select(select).order("name").range(from, to);
      if (result.error) {
        return { data: null as DbRow[] | null, error: result.error as DbError };
      }
      const rows = ((result.data ?? []) as unknown as DbRow[]).filter((r) => r && typeof r === "object");
      all.push(...rows);
      if (rows.length < PAGE_SIZE) {
        break;
      }
    }
    return { data: all, error: null as DbError | null };
  }

  let data: DbRow[] | null = null;
  let error: DbError | null = null;
  for (const select of selectCandidates) {
    const result = await fetchAllProducts(select);
    if (!result.error) {
      data = result.data;
      error = null;
      break;
    }
    error = result.error;
  }

  const migrationHint =
    (error?.message?.includes("stock_quantity") ||
      error?.message?.includes("storefront_hidden") ||
      error?.message?.includes("storefront_hidden_at") ||
      error?.message?.includes("supplier_name") ||
      error?.code === "42703")
      ? "Run the SQL migrations in supabase/migrations for products columns (stock_quantity, storefront_hidden, storefront_hidden_at) in Supabase."
      : null;

  const rows =
    data?.map((p) => ({
      id: typeof p.id === "string" ? p.id : String(p.id ?? ""),
      name: typeof p.name === "string" ? p.name : String(p.name ?? ""),
      category: typeof p.category === "string" ? p.category : null,
      supplierName: (p as { supplier_name?: string | null }).supplier_name ?? null,
      base_price: typeof p.base_price === "number" ? p.base_price : null,
      sale_price: typeof (p as { sale_price?: unknown }).sale_price === "number" ? (p as { sale_price: number }).sale_price : null,
      stock_quantity: typeof p.stock_quantity === "number" ? p.stock_quantity : 0,
      storefront_hidden: (p as { storefront_hidden?: boolean | null }).storefront_hidden ?? null,
      storefront_hidden_at: (p as { storefront_hidden_at?: string | null }).storefront_hidden_at ?? null,
      imageUrl:
        Array.isArray((p as { image_urls?: unknown }).image_urls) &&
        typeof (p as { image_urls?: unknown[] }).image_urls?.[0] === "string"
          ? String((p as { image_urls?: unknown[] }).image_urls?.[0]).trim()
          : null,
    })) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Stock
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Stock management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Update on-hand units per product. Rows at or below <strong>{LOW_STOCK_THRESHOLD}</strong> units are flagged
          as low stock.
        </p>
      </header>

      {error && !migrationHint && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error.message}</p>
      )}
      {migrationHint && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {migrationHint} Ensure <code className="rounded bg-amber-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> is set
          for admin updates.
        </p>
      )}

      <StockTableClientShell products={rows} lowStockThreshold={LOW_STOCK_THRESHOLD} />
    </div>
  );
}

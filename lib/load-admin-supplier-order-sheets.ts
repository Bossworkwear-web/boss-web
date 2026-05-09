import type { Database } from "@/lib/database.types";
import { getPerthDateSheetRangeDescending } from "@/lib/perth-calendar";
import {
  backfillEmptySupplierFromCatalog,
  resolveProductImageUrlsByProductKeys,
} from "@/lib/supplier-line-catalog-supplier";
import { supplierOrderLinesLoadErrorMessage } from "@/lib/supplier-order-lines-db-error";
import { createSupabaseAdminClient } from "@/lib/supabase";

type SupplierOrderLine = Database["public"]["Tables"]["supplier_order_lines"]["Row"];

/** Same window as Admin → Supplier orders (Perth calendar days, newest first). */
export const ADMIN_SUPPLIER_ORDER_SHEET_DAY_WINDOW = 60;

async function fetchSupplierOrderLines(
  oldestYmd: string,
  newestYmd: string,
): Promise<{ lines: SupplierOrderLine[]; error: string | null }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("supplier_order_lines")
    .select("*")
    .gte("list_date", oldestYmd)
    .lte("list_date", newestYmd)
    .order("list_date", { ascending: false })
    .order("supplier", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { lines: [], error: supplierOrderLinesLoadErrorMessage(error) };
  }

  return { lines: (data ?? []) as SupplierOrderLine[], error: null };
}

export type LoadedAdminSupplierOrderSheets = {
  sheetDates: string[];
  linesByDate: Record<string, SupplierOrderLine[]>;
  productImageByProductKey: Record<string, string | null>;
  loadError: string | null;
  generatedAt: Date;
};

/** Loads grouped supplier worksheet lines + catalog images for admin print/list UIs. */
export async function loadAdminSupplierOrderSheets(opts?: { at?: Date }): Promise<LoadedAdminSupplierOrderSheets> {
  const generatedAt = opts?.at ?? new Date();
  const sheetDates = getPerthDateSheetRangeDescending(ADMIN_SUPPLIER_ORDER_SHEET_DAY_WINDOW, generatedAt);
  const oldestYmd = sheetDates[sheetDates.length - 1]!;
  const newestYmd = sheetDates[0]!;

  let loadError: string | null = null;
  let lines: SupplierOrderLine[] = [];
  let productImageByProductKey: Record<string, string | null> = {};

  try {
    const result = await fetchSupplierOrderLines(oldestYmd, newestYmd);
    lines = result.lines;
    loadError = result.error;
    if (!loadError && lines.length > 0) {
      const supabase = createSupabaseAdminClient();
      lines = await backfillEmptySupplierFromCatalog(supabase, lines);
      const keys = [...new Set(lines.map((l) => l.product_id.trim()).filter(Boolean))];
      if (keys.length > 0) {
        const imgMap = await resolveProductImageUrlsByProductKeys(supabase, keys);
        productImageByProductKey = Object.fromEntries(keys.map((k) => [k, imgMap.get(k) ?? null]));
      }
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    loadError =
      `Could not load lines (${detail}). ` +
      "Confirm NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set (non-empty) in .env.local, save, then restart the dev server.";
  }

  const linesByDate: Record<string, SupplierOrderLine[]> = {};
  for (const d of sheetDates) {
    linesByDate[d] = [];
  }
  for (const line of lines) {
    const k = line.list_date;
    if (linesByDate[k] !== undefined) {
      linesByDate[k]!.push(line);
    }
  }
  for (const d of sheetDates) {
    linesByDate[d]!.sort((a, b) => {
      const sup = a.supplier.localeCompare(b.supplier);
      if (sup !== 0) return sup;
      return a.created_at.localeCompare(b.created_at);
    });
  }

  return { sheetDates, linesByDate, productImageByProductKey, loadError, generatedAt };
}

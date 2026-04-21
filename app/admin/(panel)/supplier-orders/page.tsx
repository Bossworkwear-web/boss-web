import Link from "next/link";

import { completeOrdersDocFromSearchParam } from "@/lib/complete-orders-doc-query";
import type { Database } from "@/lib/database.types";
import { getPerthDateSheetRangeDescending } from "@/lib/perth-calendar";
import {
  backfillEmptySupplierFromCatalog,
  resolveProductImageUrlsByProductKeys,
} from "@/lib/supplier-line-catalog-supplier";
import { supplierOrderLinesLoadErrorMessage } from "@/lib/supplier-order-lines-db-error";
import { createSupabaseAdminClient } from "@/lib/supabase";

import { SupplierOrdersByDayClient } from "./supplier-orders-by-day-client";

type SupplierOrderLine = Database["public"]["Tables"]["supplier_order_lines"]["Row"];

/** Perth calendar days to show (newest first); each day always renders a table, even when empty. */
const SHEET_DAY_WINDOW = 60;

function formatGeneratedAt(date: Date) {
  return date.toLocaleString("en-AU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Australia/Perth",
  });
}

type SupplierOrdersSearch = { complete_orders_doc?: string };

export default async function AdminSupplierOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<SupplierOrdersSearch>;
}) {
  const q = searchParams ? await searchParams : {};
  const completeOrdersDocumentsView = completeOrdersDocFromSearchParam(q.complete_orders_doc);
  const generatedAt = new Date();
  const listDateLabel = formatGeneratedAt(generatedAt);
  const listDateIso = generatedAt.toISOString();

  const sheetDates = getPerthDateSheetRangeDescending(SHEET_DAY_WINDOW, generatedAt);
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

  const storeOrderNumberOptions = await fetchRecentStoreOrderNumbers();
  const productSupplierNameOptions = await fetchDistinctProductSupplierNames();
  const readyByDate = await fetchDailySheetReadyFlags(sheetDates);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Supplier orders
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Supplier orders</h1>
        <p className="mt-2 text-sm text-slate-600">
          One worksheet per calendar day (Australia/Perth). <strong>Add row</strong> adds a line to that day’s sheet
          only. <strong>Order date</strong> is for supplier PO dates; the monthly report (25th) uses that field.{" "}
          <strong>Supplier name</strong> uses the same values as catalog <span className="font-mono">supplier_name</span>{" "}
          (suggestions from your products). <strong>Customer order ID</strong> should match{" "}
          <strong>Store orders → Customer order ID</strong> (e.g. <span className="font-mono">BOS_…</span>).
        </p>
      </header>

      <SupplierOrdersByDayClient
        sheetDates={sheetDates}
        linesByDate={linesByDate}
        migrationHint={loadError}
        completeOrdersDocumentsView={completeOrdersDocumentsView}
        readyByDate={readyByDate}
        storeOrderNumberOptions={storeOrderNumberOptions}
        productSupplierNameOptions={productSupplierNameOptions}
        productImageByProductKey={productImageByProductKey}
        pageOpenedLabel={listDateLabel}
        pageOpenedIso={listDateIso}
      />
    </div>
  );
}

/** Ready-for-processing flags for Click Up (optional table `supplier_daily_sheets`). */
async function fetchDailySheetReadyFlags(ymds: string[]): Promise<Record<string, boolean>> {
  const init: Record<string, boolean> = {};
  for (const d of ymds) init[d] = false;
  if (ymds.length === 0) return init;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("supplier_daily_sheets")
      .select("list_date, ready_for_processing")
      .in("list_date", ymds);
    if (error || !data) return init;
    for (const row of data) {
      if (row.list_date in init) {
        init[row.list_date] = row.ready_for_processing;
      }
    }
    return init;
  } catch {
    return init;
  }
}

/** Distinct non-empty `products.supplier_name` values for Supplier column datalist. */
async function fetchDistinctProductSupplierNames(): Promise<string[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("products").select("supplier_name").limit(8000);
    if (error || !data) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of data) {
      const s = row.supplier_name?.trim() ?? "";
      if (s.length > 0 && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
    out.sort((a, b) => a.localeCompare(b));
    return out;
  } catch {
    return [];
  }
}

async function fetchRecentStoreOrderNumbers(): Promise<string[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("store_orders")
      .select("order_number")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error || !data) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of data) {
      const n = row.order_number?.trim();
      if (n && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
    return out;
  } catch {
    return [];
  }
}

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

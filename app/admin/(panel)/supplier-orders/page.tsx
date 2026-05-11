import Link from "next/link";

import { completeOrdersDocFromSearchParam } from "@/lib/complete-orders-doc-query";
import { warehouseManagerViewFromSearchParam } from "@/lib/supplier-orders-warehouse-manager";
import { loadAdminSupplierOrderSheets } from "@/lib/load-admin-supplier-order-sheets";
import { createSupabaseAdminClient } from "@/lib/supabase";

import { SupplierOrdersByDayClient } from "./supplier-orders-by-day-client";

function formatGeneratedAt(date: Date) {
  return date.toLocaleString("en-AU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Australia/Perth",
  });
}

type SupplierOrdersSearch = { complete_orders_doc?: string; warehouse_manager?: string };

export default async function AdminSupplierOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<SupplierOrdersSearch>;
}) {
  const q = searchParams ? await searchParams : {};
  const completeOrdersDocumentsView = completeOrdersDocFromSearchParam(q.complete_orders_doc);
  const warehouseManagerView = warehouseManagerViewFromSearchParam(q.warehouse_manager);
  const generatedAt = new Date();
  const listDateLabel = formatGeneratedAt(generatedAt);
  const listDateIso = generatedAt.toISOString();

  const { sheetDates, linesByDate, productImageByProductKey, incomingReceivedYmdByStoreItemId, loadError } =
    await loadAdminSupplierOrderSheets({ at: generatedAt });

  const storeOrderNumberOptions = await fetchRecentStoreOrderNumbers();
  const productSupplierNameOptions = await fetchDistinctProductSupplierNames();

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
          <strong>Store orders → Customer order ID</strong> (e.g. <span className="font-mono">BOS_…</span>).{" "}
          New <strong>web checkout</strong> lines also add that Perth day to{" "}
          <Link href="/admin/work-process" className="font-semibold text-brand-orange hover:underline">
            Click Up
          </Link>{" "}
          automatically.{" "}
          <strong>Received</strong> for web-order lines is read-only and matches{" "}
          <Link href="/admin/incoming-goods" className="font-semibold text-brand-orange hover:underline">
            Incoming goods
          </Link>
          .
        </p>
      </header>

      <SupplierOrdersByDayClient
        sheetDates={sheetDates}
        linesByDate={linesByDate}
        migrationHint={loadError}
        completeOrdersDocumentsView={completeOrdersDocumentsView}
        warehouseManagerView={warehouseManagerView}
        storeOrderNumberOptions={storeOrderNumberOptions}
        productSupplierNameOptions={productSupplierNameOptions}
        productImageByProductKey={productImageByProductKey}
        incomingReceivedYmdByStoreItemId={incomingReceivedYmdByStoreItemId}
        pageOpenedLabel={listDateLabel}
        pageOpenedIso={listDateIso}
      />
    </div>
  );
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


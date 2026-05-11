import Link from "next/link";

import {
  ADMIN_SUPPLIER_ORDER_SHEET_DAY_WINDOW,
  loadAdminSupplierOrderSheets,
} from "@/lib/load-admin-supplier-order-sheets";

import { WorkerSupplierPrintListClient } from "./worker-supplier-print-list-client";

export const dynamic = "force-dynamic";

function formatOpenedAt(date: Date) {
  return date.toLocaleString("en-AU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Australia/Perth",
  });
}

export default async function WarehouseWorkerPrintDeliveredItemsPage() {
  const generatedAt = new Date();
  const { sheetDates, linesByDate, productImageByProductKey, incomingReceivedYmdByStoreItemId, loadError } =
    await loadAdminSupplierOrderSheets({ at: generatedAt });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          /{" "}
          <Link href="/admin/warehouse" className="text-brand-orange hover:underline">
            Warehouse
          </Link>{" "}
          /{" "}
          <Link href="/admin/warehouse/worker" className="text-brand-orange hover:underline">
            Worker
          </Link>{" "}
          / Print delivered items
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Print delivered items</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Daily <strong>Supplier orders</strong> worksheets (Australia/Perth list dates). Print a sheet to get the same
          supplier-line table used in admin — useful for dock checks and received-goods paperwork. For per-customer
          dockets, use{" "}
          <Link href="/admin/warehouse/worker/store-orders" className="font-semibold text-brand-orange hover:underline">
            Completed store orders
          </Link>
          .
        </p>
        <p className="mt-2 text-sm">
          <Link href="/admin/supplier-orders" className="font-semibold text-brand-orange hover:underline">
            Full Supplier orders (edit) →
          </Link>
        </p>
      </header>

      <WorkerSupplierPrintListClient
        sheetDates={sheetDates}
        linesByDate={linesByDate}
        productImageByProductKey={productImageByProductKey}
        incomingReceivedYmdByStoreItemId={incomingReceivedYmdByStoreItemId}
        migrationHint={loadError}
        pageOpenedLabel={formatOpenedAt(generatedAt)}
        pageOpenedIso={generatedAt.toISOString()}
      />

      <p className="text-xs text-slate-500">
        Loaded window: last <strong>{ADMIN_SUPPLIER_ORDER_SHEET_DAY_WINDOW}</strong> Perth calendar days (newest first).
      </p>
    </div>
  );
}

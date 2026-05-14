"use client";

import dynamic from "next/dynamic";

import type { StockRow } from "./stock-table";

const StockTable = dynamic(() => import("./stock-table").then((m) => m.StockTable), { ssr: false });

export function StockTableClientShell({
  products,
  lowStockThreshold,
  warehouseStockView = false,
}: {
  products: StockRow[];
  lowStockThreshold: number;
  /** Set when opened from Dashboard → Warehouse (hides supplier/retail/sale price columns). */
  warehouseStockView?: boolean;
}) {
  return (
    <StockTable
      products={products}
      lowStockThreshold={lowStockThreshold}
      warehouseStockView={warehouseStockView}
    />
  );
}


"use client";

import dynamic from "next/dynamic";

import type { StockRow } from "./stock-table";

const StockTable = dynamic(() => import("./stock-table").then((m) => m.StockTable), { ssr: false });

export function StockTableClientShell({
  products,
  lowStockThreshold,
}: {
  products: StockRow[];
  lowStockThreshold: number;
}) {
  return <StockTable products={products} lowStockThreshold={lowStockThreshold} />;
}


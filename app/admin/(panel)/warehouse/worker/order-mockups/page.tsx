import Link from "next/link";

import {
  listClickUpMockupsByStoreOrderNumber,
  type ClickUpSheetImageDto,
} from "@/app/admin/(panel)/click-up-sheet/actions";

import { OrderMockupsImageGrid } from "./order-mockups-image-grid";

export const dynamic = "force-dynamic";

type Search = { order?: string };

export default async function WarehouseWorkerOrderMockupsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const q = await searchParams;
  const order = (q.order ?? "").trim();

  let loadError: string | null = null;
  let images: ClickUpSheetImageDto[] = [];

  if (order) {
    const res = await listClickUpMockupsByStoreOrderNumber(order);
    if (res.ok) {
      images = res.images;
    } else {
      loadError = res.error;
    }
  }

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
          / Order mock-ups
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Order mock-ups</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Enter the <strong>store order number</strong> (same value as <span className="font-mono">Order ID</span> on
          Click up sheet). Shows mock-up images and PDFs uploaded from Admin → Click up sheet →{" "}
          <strong>Mock-up designs</strong>.
        </p>
      </header>

      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        method="get"
        action="/admin/warehouse/worker/order-mockups"
      >
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="order-mockup-q" className="text-xs font-medium text-slate-600">
            Customer order ID
          </label>
          <input
            id="order-mockup-q"
            name="order"
            defaultValue={order}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
            placeholder="e.g. store order #"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95"
        >
          Load mock-ups
        </button>
      </form>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadError}</div>
      ) : null}

      {!order ? (
        <p className="text-sm text-slate-600">Enter an order number and press Load mock-ups.</p>
      ) : images.length === 0 && !loadError ? (
        <p className="text-sm text-slate-600">
          No mock-up files for <span className="font-mono font-semibold">{order}</span>. Ask admin to upload in Click
          up sheet (Mock-up designs) for that order.
        </p>
      ) : (
        <OrderMockupsImageGrid images={images} order={order} />
      )}
    </div>
  );
}

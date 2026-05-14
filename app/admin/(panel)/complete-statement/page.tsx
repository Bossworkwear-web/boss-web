import Link from "next/link";

import { CompleteStatementLocalSnapshot } from "@/app/admin/(panel)/complete-statement/complete-statement-local-snapshot";
import { australiaPostTrackingUrl, formatMoneyFromCents, siteBaseUrl } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Search = { list_date?: string; customer_order_id?: string };

function clickUpHref(listDate: string, customerOrderId: string) {
  return `/admin/click-up-sheet?${new URLSearchParams({ list_date: listDate, customer_order_id: customerOrderId }).toString()}`;
}

function qualityHref(listDate: string, customerOrderId: string) {
  return `/admin/quality-check-sheet?${new URLSearchParams({ list_date: listDate, customer_order_id: customerOrderId }).toString()}`;
}

export default async function CompleteStatementPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const q = await searchParams;
  const listDate = (q.list_date ?? "").trim();
  const customerOrderId = (q.customer_order_id ?? "").trim();
  const hasContext = listDate.length > 0 && customerOrderId.length > 0;

  type SupplierLine = {
    id: string;
    supplier: string;
    product_id: string;
    colour: string;
    size: string;
    quantity: number;
    notes: string;
    unit_price_cents: number;
    list_date: string;
  };

  let supplierLines: SupplierLine[] = [];
  let storeOrder: {
    id: string;
    order_number: string;
    status: string;
    carrier: string;
    tracking_number: string | null;
    shipped_at: string | null;
    tracking_token: string;
    customer_name: string;
    customer_email: string;
    delivery_address: string;
    total_cents: number;
    currency: string;
    created_at: string;
  } | null = null;
  let storeItems: { product_name: string; quantity: number; unit_price_cents: number }[] = [];

  if (hasContext) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data: sol } = await supabase
        .from("supplier_order_lines")
        .select("id, supplier, product_id, colour, size, quantity, notes, unit_price_cents, list_date")
        .eq("list_date", listDate)
        .eq("customer_order_id", customerOrderId)
        .order("created_at", { ascending: true });

      supplierLines = (sol ?? []) as SupplierLine[];

      const { data: so } = await supabase
        .from("store_orders")
        .select(
          "id, order_number, status, carrier, tracking_number, shipped_at, tracking_token, customer_name, customer_email, delivery_address, total_cents, currency, created_at",
        )
        .eq("order_number", customerOrderId)
        .maybeSingle();

      if (so) {
        storeOrder = so;
        const { data: items } = await supabase
          .from("store_order_items")
          .select("product_name, quantity, unit_price_cents")
          .eq("order_id", so.id)
          .order("sort_order", { ascending: true });
        storeItems = items ?? [];
      }
    } catch {
      /* Supabase unavailable */
    }
  }

  const baseUrl = siteBaseUrl();
  const customerTrackUrl =
    storeOrder != null ? `${baseUrl}/orders/track/${storeOrder.tracking_token}` : null;
  const ausPostLink =
    storeOrder?.tracking_number != null && storeOrder.tracking_number.trim().length > 0
      ? australiaPostTrackingUrl(storeOrder.tracking_number)
      : null;

  return (
    <main className="space-y-6">
      <nav className="text-sm text-slate-600">
        <Link href="/admin/work-process" className="font-semibold text-brand-orange hover:underline">
          Work process
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-brand-navy">Complete Statement</span>
      </nav>

      <div>
        <h1 className="text-3xl font-medium text-brand-navy">Complete Statement</h1>
        <p className="mt-2 text-sm text-slate-600">
          Order completion summary: workflow links, supplier worksheet data, store order and Australia Post tracking.
        </p>
      </div>

      {!hasContext ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-6 text-sm text-amber-950">
          Open this page from <strong>Work process</strong> → <strong>Order Complete</strong> so list date and customer
          order ID are filled in.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-brand-navy">Order</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-500">List date</dt>
                <dd className="mt-1 font-mono text-brand-navy">{listDate}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-500">Customer order ID</dt>
                <dd className="mt-1 font-mono text-brand-navy">{customerOrderId}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-brand-navy">Process workspace links</h2>
            <p className="mt-1 text-sm text-slate-600">Jump back to any step for this list date and order.</p>
            <ul className="mt-4 flex flex-wrap gap-3">
              <li>
                <Link
                  href={clickUpHref(listDate, customerOrderId)}
                  className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50"
                >
                  Click up sheet
                </Link>
              </li>
              <li>
                <Link
                  href={qualityHref(listDate, customerOrderId)}
                  className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50"
                >
                  Quality Check sheet
                </Link>
              </li>
              {storeOrder ? (
                <li>
                  <Link
                    href={`/admin/store-orders/${storeOrder.id}/docket`}
                    className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50"
                  >
                    AusPost docket
                  </Link>
                </li>
              ) : null}
              {storeOrder ? (
                <li>
                  <Link
                    href="/admin/store-orders"
                    className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50"
                  >
                    Store orders (admin)
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-brand-navy">Supplier worksheet lines</h2>
            <p className="mt-1 text-sm text-slate-600">Rows on the daily supplier sheet for this order.</p>
            {supplierLines.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No supplier lines found for this list date and customer order ID.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Supplier</th>
                      <th className="px-3 py-2">SKU / product</th>
                      <th className="px-3 py-2">Colour</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {supplierLines.map((row) => (
                      <tr key={row.id} className="bg-white">
                        <td className="px-3 py-2 text-slate-800">{row.supplier}</td>
                        <td className="px-3 py-2 font-mono text-xs text-brand-navy">{row.product_id}</td>
                        <td className="px-3 py-2 text-slate-700">{row.colour}</td>
                        <td className="px-3 py-2 text-slate-700">{row.size}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-slate-600" title={row.notes}>
                          {row.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {storeOrder ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-brand-navy">Store order</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Customer</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {storeOrder.customer_name} · {storeOrder.customer_email}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Status</dt>
                  <dd className="mt-0.5 capitalize text-slate-900">{storeOrder.status}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-slate-500">Total</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {formatMoneyFromCents(storeOrder.total_cents, storeOrder.currency)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-slate-500">Delivery address</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-slate-800">{storeOrder.delivery_address}</dd>
                </div>
              </dl>
              {storeItems.length > 0 ? (
                <div className="mt-6 overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {storeItems.map((it, i) => (
                        <tr key={`${it.product_name}-${i}`}>
                          <td className="px-3 py-2 text-slate-800">{it.product_name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {formatMoneyFromCents(it.unit_price_cents, storeOrder.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50/80 px-5 py-4 text-sm text-slate-600">
              No matching <strong>store order</strong> for this customer order ID. Tracking and line items will show here
              once <span className="font-mono">order_number</span> matches.
            </p>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-brand-navy">Australia Post &amp; tracking</h2>
            {!storeOrder ? (
              <p className="mt-3 text-sm text-slate-600">Link a store order to see carrier and tracking fields.</p>
            ) : (
              <div className="mt-4 space-y-4 text-sm">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Carrier</dt>
                    <dd className="mt-0.5 text-slate-900">{storeOrder.carrier || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Tracking number</dt>
                    <dd className="mt-0.5 font-mono text-slate-900">{storeOrder.tracking_number || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Shipped at</dt>
                    <dd className="mt-0.5 text-slate-900">
                      {storeOrder.shipped_at
                        ? new Date(storeOrder.shipped_at).toLocaleString("en-AU", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Expected delivery</dt>
                    <dd className="mt-0.5 text-slate-900">
                      Not stored in Boss Web. Australia Post shows estimated delivery on the public tracker when the
                      service supports it — use <strong>Track on Australia Post</strong> below when you have a tracking
                      number.
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-3">
                  {customerTrackUrl ? (
                    <a
                      href={customerTrackUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy transition hover:brightness-95"
                    >
                      Customer tracking page
                    </a>
                  ) : null}
                  {ausPostLink ? (
                    <a
                      href={ausPostLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50"
                    >
                      Track on Australia Post
                    </a>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <CompleteStatementLocalSnapshot listDate={listDate} customerOrderId={customerOrderId} />
        </>
      )}
    </main>
  );
}
